#!/usr/bin/env python3
"""
Verboo 产品词库构建脚本

数据源优先级（准确性从高到低）：
1. ECDICT stardict.db - 中文释义、音标、考试标签(cet4/cet6/ky/toefl/ielts/gre)、柯林斯星级、牛津3000
2. COCA 词频表 - 美式英语词频排名（更权威）
3. cefrpy - CEFR 等级 (A1-C2)
4. ECDICT bnc/frq - 作为词频的补充参考

筛选规则：
- 入库：Oxford 3000 OR 考试词汇(任意标签) OR COCA前20000 OR BNC前15000
- 排除：纯符号、数字、单字母（除 I/a）

输出：约 15000-20000 高价值词汇
"""

import sqlite3
import csv
import os
import re
from typing import Optional, Dict, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum

# 尝试导入 xlrd (读取高考词汇 xls)
try:
    import xlrd
    XLRD_AVAILABLE = True
except ImportError:
    XLRD_AVAILABLE = False
    print("Warning: xlrd not installed. Run: pip install xlrd")

# 尝试导入 nltk wordnet
try:
    import nltk
    # 自动下载 wordnet 数据（如果没有）
    try:
        nltk.data.find('corpora/wordnet')
    except LookupError:
        print("Downloading WordNet data...")
        nltk.download('wordnet', quiet=True)

    from nltk.corpus import wordnet as wn
    WORDNET_AVAILABLE = True
except ImportError:
    WORDNET_AVAILABLE = False
    print("Warning: NLTK not installed. Run: pip install nltk")


# 统一的词性标识映射
POS_STANDARD = {
    # WordNet 词性映射
    'n': 'n',      # noun
    'v': 'v',      # verb
    'a': 'adj',    # adjective
    's': 'adj',    # adjective satellite (WordNet 特有，归类为 adj)
    'r': 'adv',    # adverb
    # ECDICT 常见词性映射
    'noun': 'n',
    'verb': 'v',
    'adj': 'adj',
    'adjective': 'adj',
    'adv': 'adv',
    'adverb': 'adv',
    'prep': 'prep',
    'preposition': 'prep',
    'pron': 'pron',
    'pronoun': 'pron',
    'conj': 'conj',
    'conjunction': 'conj',
    'det': 'det',
    'determiner': 'det',
    'interj': 'interj',
    'interjection': 'interj',
    'art': 'art',
    'article': 'art',
    # 其他可能的缩写
    'vt': 'v',     # transitive verb
    'vi': 'v',     # intransitive verb
    'vt.': 'v',
    'vi.': 'v',
    'n.': 'n',
    'v.': 'v',
    'adj.': 'adj',
    'adv.': 'adv',
    'j': 'adj',    # ECDICT 中 j 代表 adjective
    't': 'v',      # 可能是动词的某种标记
    'u': 'unknown',
}


# CEFR 等级映射 (数字 -> 字符串)
CEFR_LEVEL_MAP = {
    1: 'A1',
    2: 'A2',
    3: 'B1',
    4: 'B2',
    5: 'C1',
    6: 'C2',
}


def cefr_from_float(level: float) -> str:
    """将浮点数等级转换为 CEFR 字符串"""
    if level <= 0:
        return ""
    # 四舍五入到最近的整数等级
    rounded = round(level)
    return CEFR_LEVEL_MAP.get(rounded, "")


@dataclass
class WordEntry:
    """单词条目数据结构"""
    word: str
    phonetic: str = ""
    definition_en: str = ""
    definition_cn: str = ""
    pos: str = ""

    # 等级与词频
    cefr_level: str = ""
    collins_star: int = 0
    coca_rank: int = 0
    bnc_rank: int = 0

    # 考试标签
    is_oxford_3000: bool = False
    is_cet4: bool = False
    is_cet6: bool = False
    is_zk: bool = False  # 中考
    is_gk: bool = False  # 高考
    is_ky: bool = False  # 考研
    is_toefl: bool = False
    is_ielts: bool = False
    is_gre: bool = False

    # 扩展信息
    exchange: str = ""  # 时态变形

    # 数据源追踪（用于调试和质量保证）
    data_sources: str = ""


class VocabularyBuilder:
    """词库构建器"""

    # 词频阈值
    COCA_THRESHOLD = 20000
    BNC_THRESHOLD = 15000

    # 排除的单词模式
    EXCLUDE_PATTERNS = [
        r'^[0-9]+$',           # 纯数字
        r'^[^a-zA-Z]+$',       # 无字母
        r'^[a-zA-Z]$',         # 单字母（后面会特殊处理 I, a）
        r'.*\d+.*',            # 包含数字的词
        r'^(.)\1+$',           # 重复字母词 (aa, aaa, bbb, zzz 等)
        r'^[a-z]{1,2}$',       # 1-2字母的词（后面会特殊处理少数有意义的）
    ]

    # 允许的单字母词
    ALLOWED_SINGLE_LETTERS = {'i', 'a'}

    # 允许的双字母词（有实际意义的）
    ALLOWED_TWO_LETTERS = {
        'am', 'an', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'if',
        'in', 'is', 'it', 'me', 'my', 'no', 'of', 'on', 'or', 'so',
        'to', 'up', 'us', 'we', 'ok', 'ox', 'ax'
    }

    # 高频无意义词/噪音词（需要过滤掉）
    STOPWORDS = {
        # 重复字母组合
        'aa', 'aaa', 'aaaa', 'bb', 'bbb', 'cc', 'ccc', 'dd', 'ddd',
        'ee', 'eee', 'ff', 'fff', 'gg', 'ggg', 'hh', 'hhh', 'ii', 'iii',
        'jj', 'jjj', 'kk', 'kkk', 'll', 'lll', 'mm', 'mmm', 'nn', 'nnn',
        'oo', 'ooo', 'pp', 'ppp', 'qq', 'qqq', 'rr', 'rrr', 'ss', 'sss',
        'tt', 'ttt', 'uu', 'uuu', 'vv', 'vvv', 'ww', 'www', 'xx', 'xxx',
        'yy', 'yyy', 'zz', 'zzz',
        # 无意义的缩写/符号词
        'zzzzz', 'hmmm', 'hmm', 'umm', 'ummm', 'uhh', 'uhhh', 'ahh', 'ahhh',
        'ohh', 'ohhh', 'ehh', 'shhh', 'shh', 'psst', 'tsk', 'ugh', 'argh',
        'blah', 'meh', 'duh', 'huh', 'nah', 'yeah', 'yep', 'yup', 'nope',
        # 网络用语/非正式缩写（不适合词库）
        'lol', 'omg', 'wtf', 'btw', 'idk', 'imo', 'imho', 'fyi', 'asap',
        'brb', 'ttyl', 'rofl', 'lmao', 'smh', 'tbh', 'tho', 'thx', 'pls',
        'plz', 'cuz', 'coz', 'gonna', 'wanna', 'gotta', 'kinda', 'sorta',
        # 其他噪音
        'etc', 'vs', 'ie', 'eg', 'nb', 'ps', 'aka', 'diy', 'faq',
    }

    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.words: Dict[str, WordEntry] = {}
        self.coca_ranks: Dict[str, int] = {}
        self.cefr_data: Dict[str, float] = {}  # word -> cefr level (1-6)
        self.gaokao_words: Set[str] = set()    # 高考词汇集合

    def load_coca_frequency(self) -> None:
        """加载 COCA 词频数据"""
        print("Loading COCA word frequency...")
        coca_path = os.path.join(self.data_dir, "COCA_WordFrequency.csv")

        if not os.path.exists(coca_path):
            print(f"  Warning: {coca_path} not found")
            return

        with open(coca_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    word = row.get('lemma', '').lower().strip()
                    rank = int(row.get('rank', 0))
                    if word and rank > 0:
                        # 只保留排名最高的（数字最小）
                        if word not in self.coca_ranks or rank < self.coca_ranks[word]:
                            self.coca_ranks[word] = rank
                except (ValueError, KeyError):
                    continue

        print(f"  Loaded {len(self.coca_ranks)} COCA entries")

    def load_cefr_database(self) -> None:
        """加载 CEFR 词汇等级数据库"""
        print("Loading CEFR database...")
        db_path = os.path.join(self.data_dir, "word_cefr_minified.db")

        if not os.path.exists(db_path):
            print(f"  Warning: {db_path} not found")
            return

        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # 查询每个单词的平均 CEFR 等级（一个词可能有多个词性，取平均）
        cursor.execute("""
            SELECT w.word, AVG(wp.level) as avg_level
            FROM words w
            JOIN word_pos wp ON w.word_id = wp.word_id
            GROUP BY w.word
        """)

        for row in cursor.fetchall():
            word = row[0].lower().strip()
            level = row[1]
            if word and level:
                self.cefr_data[word] = level

        conn.close()
        print(f"  Loaded {len(self.cefr_data)} CEFR entries")

    def load_gaokao_vocabulary(self) -> None:
        """加载高考 3500 词汇表"""
        print("Loading Gaokao vocabulary...")

        if not XLRD_AVAILABLE:
            print("  Warning: xlrd not available, skipping Gaokao vocabulary")
            return

        xls_path = os.path.join(self.data_dir, "1、高考3500个英语单词表(带音标.xls")

        if not os.path.exists(xls_path):
            print(f"  Warning: {xls_path} not found")
            return

        try:
            wb = xlrd.open_workbook(xls_path)
            sheet = wb.sheet_by_index(0)

            for i in range(1, sheet.nrows):  # 跳过表头
                word = sheet.cell_value(i, 1)  # 第2列是单词
                if word:
                    # 清理单词（去除空格、处理 a(an) 这种格式）
                    word = str(word).strip().replace('\xa0', '')
                    # 处理 "a(an)" 这种格式，提取主单词
                    if '(' in word:
                        word = word.split('(')[0].strip()
                    word = word.lower()
                    if word:
                        self.gaokao_words.add(word)

            print(f"  Loaded {len(self.gaokao_words)} Gaokao words")
        except Exception as e:
            print(f"  Error loading Gaokao vocabulary: {e}")

    def load_stardict(self) -> None:
        """加载 ECDICT stardict 数据库"""
        print("Loading ECDICT stardict database...")
        db_path = os.path.join(self.data_dir, "stardict 2.db")

        if not os.path.exists(db_path):
            print(f"  Warning: {db_path} not found")
            return

        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # 查询所有词条
        cursor.execute("""
            SELECT word, phonetic, definition, translation, pos,
                   collins, oxford, tag, bnc, frq, exchange
            FROM stardict
        """)

        loaded = 0
        for row in cursor.fetchall():
            word = row[0].lower().strip() if row[0] else ""

            if not word or not self._is_valid_word(word):
                continue

            # 解析标签
            tag = row[7] or ""
            tags = set(tag.split())

            entry = WordEntry(
                word=word,
                phonetic=row[1] or "",
                definition_en=row[2] or "",
                definition_cn=row[3] or "",
                pos=row[4] or "",
                collins_star=row[5] or 0,
                is_oxford_3000=bool(row[6]),
                bnc_rank=row[8] or 0,
                exchange=row[10] or "",
                # 考试标签
                is_zk='zk' in tags,
                is_gk='gk' in tags,
                is_cet4='cet4' in tags,
                is_cet6='cet6' in tags,
                is_ky='ky' in tags,
                is_toefl='toefl' in tags,
                is_ielts='ielts' in tags,
                is_gre='gre' in tags,
                data_sources="ecdict"
            )

            # ECDICT 的 frq 字段 (COCA 词频)
            if row[9]:
                entry.coca_rank = row[9]

            self.words[word] = entry
            loaded += 1

        conn.close()
        print(f"  Loaded {loaded} words from stardict")

    def _normalize_pos(self, raw_pos: str) -> str:
        """
        标准化词性格式
        输入: "a:99/t:1" 或 "n:100" 或 "noun" 等
        输出: "adj,v" 或 "n" 等（统一格式，按频率排序）
        """
        if not raw_pos:
            return ""

        pos_list = []

        # 解析 ECDICT 格式: "a:99/t:1" 或 "n:4/v:96"
        if ':' in raw_pos:
            parts = raw_pos.split('/')
            pos_freq = []
            for part in parts:
                if ':' in part:
                    pos_code, freq_str = part.split(':')
                    pos_code = pos_code.strip().lower()
                    try:
                        freq = int(freq_str)
                    except ValueError:
                        freq = 0
                    # 标准化词性
                    std_pos = POS_STANDARD.get(pos_code, '')
                    if std_pos and std_pos != 'unknown':
                        pos_freq.append((std_pos, freq))

            # 按频率降序排序，去重
            pos_freq.sort(key=lambda x: -x[1])
            seen = set()
            for pos, _ in pos_freq:
                if pos not in seen:
                    pos_list.append(pos)
                    seen.add(pos)
        else:
            # 简单格式: "noun" 或 "n"
            pos_code = raw_pos.strip().lower()
            std_pos = POS_STANDARD.get(pos_code, '')
            if std_pos and std_pos != 'unknown':
                pos_list.append(std_pos)

        return ','.join(pos_list)

    def _get_pos_from_wordnet(self, word: str) -> str:
        """从 WordNet 获取词性（按使用频率排序）"""
        if not WORDNET_AVAILABLE:
            return ""

        try:
            synsets = wn.synsets(word)
            if not synsets:
                return ""

            # 统计各词性的 synset 数量（作为频率近似）
            pos_count = {}
            for syn in synsets:
                pos = syn.pos()
                std_pos = POS_STANDARD.get(pos, '')
                if std_pos and std_pos != 'unknown':
                    pos_count[std_pos] = pos_count.get(std_pos, 0) + 1

            # 按数量降序排序
            sorted_pos = sorted(pos_count.items(), key=lambda x: -x[1])
            return ','.join([p for p, _ in sorted_pos])
        except Exception:
            return ""

    def enrich_with_pos(self) -> None:
        """标准化词性并用 WordNet 补充缺失数据"""
        print("Standardizing and enriching POS data...")
        standardized = 0
        enriched_from_wordnet = 0

        for word, entry in self.words.items():
            original_pos = entry.pos

            # 先标准化现有的 pos
            if original_pos:
                entry.pos = self._normalize_pos(original_pos)
                if entry.pos:
                    standardized += 1

            # 如果没有词性或为空，从 WordNet 补充
            if not entry.pos and WORDNET_AVAILABLE:
                wordnet_pos = self._get_pos_from_wordnet(word)
                if wordnet_pos:
                    entry.pos = wordnet_pos
                    if "wordnet" not in entry.data_sources:
                        entry.data_sources += ",wordnet"
                    enriched_from_wordnet += 1

        print(f"  Standardized {standardized} POS entries")
        print(f"  Enriched {enriched_from_wordnet} words with WordNet POS")

    def enrich_with_coca(self) -> None:
        """用 COCA 数据增强词频信息（COCA 更权威）"""
        print("Enriching with COCA frequency data...")
        enriched = 0

        for word, rank in self.coca_ranks.items():
            if word in self.words:
                # COCA 优先级更高，覆盖 ECDICT 的 frq
                self.words[word].coca_rank = rank
                if "coca" not in self.words[word].data_sources:
                    self.words[word].data_sources += ",coca"
                enriched += 1

        print(f"  Enriched {enriched} words with COCA ranks")

    def enrich_with_cefr(self) -> None:
        """用 CEFR 数据库添加 CEFR 等级"""
        if not self.cefr_data:
            print("Skipping CEFR enrichment (no CEFR data loaded)")
            return

        print("Enriching with CEFR levels...")
        enriched = 0

        for word, entry in self.words.items():
            if word in self.cefr_data:
                level = self.cefr_data[word]
                cefr_str = cefr_from_float(level)
                if cefr_str:
                    entry.cefr_level = cefr_str
                    if "cefr" not in entry.data_sources:
                        entry.data_sources += ",cefr"
                    enriched += 1

        print(f"  Added CEFR levels to {enriched} words")

    def enrich_with_gaokao(self) -> None:
        """标注高考词汇"""
        if not self.gaokao_words:
            print("Skipping Gaokao enrichment (no Gaokao data loaded)")
            return

        print("Enriching with Gaokao tags...")
        enriched = 0

        for word, entry in self.words.items():
            if word in self.gaokao_words:
                entry.is_gk = True
                enriched += 1

        print(f"  Tagged {enriched} words as Gaokao vocabulary")

    def _is_valid_word(self, word: str) -> bool:
        """检查单词是否有效"""
        word_lower = word.lower()

        # 检查停用词/噪音词
        if word_lower in self.STOPWORDS:
            return False

        # 单字母特殊处理
        if len(word) == 1:
            return word_lower in self.ALLOWED_SINGLE_LETTERS

        # 双字母特殊处理
        if len(word) == 2:
            return word_lower in self.ALLOWED_TWO_LETTERS

        # 检查排除模式
        for pattern in self.EXCLUDE_PATTERNS:
            if re.match(pattern, word_lower):
                return False

        return True

    def _should_include(self, entry: WordEntry) -> bool:
        """判断词条是否应该入库"""
        # 规则1: Oxford 3000 核心词
        if entry.is_oxford_3000:
            return True

        # 规则2: 任意考试标签
        if any([
            entry.is_cet4, entry.is_cet6, entry.is_ky,
            entry.is_toefl, entry.is_ielts, entry.is_gre,
            entry.is_gk, entry.is_zk
        ]):
            return True

        # 规则3: 高词频词汇
        if entry.coca_rank and 0 < entry.coca_rank <= self.COCA_THRESHOLD:
            return True

        if entry.bnc_rank and 0 < entry.bnc_rank <= self.BNC_THRESHOLD:
            return True

        # 规则4: 柯林斯三星及以上
        if entry.collins_star and entry.collins_star >= 3:
            return True

        return False

    def filter_words(self) -> Dict[str, WordEntry]:
        """筛选高价值词汇"""
        print("Filtering high-value vocabulary...")

        filtered = {}
        stats = {
            'oxford_3000': 0,
            'exam_words': 0,
            'high_freq': 0,
            'collins_3plus': 0,
            'total': 0
        }

        for word, entry in self.words.items():
            if self._should_include(entry):
                filtered[word] = entry
                stats['total'] += 1

                if entry.is_oxford_3000:
                    stats['oxford_3000'] += 1
                if any([entry.is_cet4, entry.is_cet6, entry.is_ky,
                       entry.is_toefl, entry.is_ielts, entry.is_gre]):
                    stats['exam_words'] += 1
                if (entry.coca_rank and entry.coca_rank <= self.COCA_THRESHOLD) or \
                   (entry.bnc_rank and entry.bnc_rank <= self.BNC_THRESHOLD):
                    stats['high_freq'] += 1
                if entry.collins_star and entry.collins_star >= 3:
                    stats['collins_3plus'] += 1

        print(f"  Filtered results:")
        print(f"    - Oxford 3000: {stats['oxford_3000']}")
        print(f"    - Exam words: {stats['exam_words']}")
        print(f"    - High frequency: {stats['high_freq']}")
        print(f"    - Collins 3+: {stats['collins_3plus']}")
        print(f"    - Total selected: {stats['total']}")

        return filtered

    def build_database(self, output_path: str) -> None:
        """构建最终的 SQLite 数据库"""
        print(f"Building output database: {output_path}")

        # 如果文件存在，先删除
        if os.path.exists(output_path):
            os.remove(output_path)

        conn = sqlite3.connect(output_path)
        cursor = conn.cursor()

        # 创建主表
        cursor.execute("""
            CREATE TABLE words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word TEXT NOT NULL UNIQUE,
                phonetic TEXT,
                definition_en TEXT,
                definition_cn TEXT,
                pos TEXT,

                cefr_level TEXT,
                collins_star INTEGER DEFAULT 0,
                coca_rank INTEGER DEFAULT 0,
                bnc_rank INTEGER DEFAULT 0,

                is_oxford_3000 INTEGER DEFAULT 0,
                is_cet4 INTEGER DEFAULT 0,
                is_cet6 INTEGER DEFAULT 0,
                is_zk INTEGER DEFAULT 0,
                is_gk INTEGER DEFAULT 0,
                is_ky INTEGER DEFAULT 0,
                is_toefl INTEGER DEFAULT 0,
                is_ielts INTEGER DEFAULT 0,
                is_gre INTEGER DEFAULT 0,

                exchange TEXT,
                data_sources TEXT
            )
        """)

        # 创建索引
        cursor.execute("CREATE INDEX idx_word ON words(word)")
        cursor.execute("CREATE INDEX idx_cefr ON words(cefr_level)")
        cursor.execute("CREATE INDEX idx_coca ON words(coca_rank)")
        cursor.execute("CREATE INDEX idx_oxford ON words(is_oxford_3000)")

        # 筛选并插入数据
        filtered = self.filter_words()

        for entry in filtered.values():
            cursor.execute("""
                INSERT INTO words (
                    word, phonetic, definition_en, definition_cn, pos,
                    cefr_level, collins_star, coca_rank, bnc_rank,
                    is_oxford_3000, is_cet4, is_cet6, is_zk, is_gk, is_ky,
                    is_toefl, is_ielts, is_gre, exchange, data_sources
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                entry.word,
                entry.phonetic,
                entry.definition_en,
                entry.definition_cn,
                entry.pos,
                entry.cefr_level,
                entry.collins_star,
                entry.coca_rank,
                entry.bnc_rank,
                int(entry.is_oxford_3000),
                int(entry.is_cet4),
                int(entry.is_cet6),
                int(entry.is_zk),
                int(entry.is_gk),
                int(entry.is_ky),
                int(entry.is_toefl),
                int(entry.is_ielts),
                int(entry.is_gre),
                entry.exchange,
                entry.data_sources
            ))

        conn.commit()

        # 输出统计
        cursor.execute("SELECT COUNT(*) FROM words")
        total = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM words WHERE cefr_level != ''")
        with_cefr = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM words WHERE definition_cn != ''")
        with_cn = cursor.fetchone()[0]

        conn.close()

        print(f"\nDatabase built successfully!")
        print(f"  - Total words: {total}")
        print(f"  - With CEFR level: {with_cefr}")
        print(f"  - With Chinese definition: {with_cn}")
        print(f"  - File size: {os.path.getsize(output_path) / 1024 / 1024:.2f} MB")

    def run(self, output_path: str) -> None:
        """执行完整的构建流程"""
        print("=" * 60)
        print("Verboo Vocabulary Database Builder")
        print("=" * 60)

        # 1. 加载数据源
        self.load_coca_frequency()
        self.load_cefr_database()
        self.load_gaokao_vocabulary()
        self.load_stardict()

        # 2. 数据增强（准确性优先）
        self.enrich_with_pos()    # 标准化词性 + WordNet 补充
        self.enrich_with_coca()   # COCA 覆盖 ECDICT 的 frq
        self.enrich_with_cefr()   # 添加 CEFR
        self.enrich_with_gaokao() # 标注高考词汇

        # 3. 构建输出数据库
        self.build_database(output_path)

        print("\nDone!")


def main():
    # 配置路径
    data_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(data_dir, "verboo_vocabulary.db")

    # 构建词库
    builder = VocabularyBuilder(data_dir)
    builder.run(output_path)

    # 验证示例查询
    print("\n" + "=" * 60)
    print("Sample queries from the built database:")
    print("=" * 60)

    conn = sqlite3.connect(output_path)
    cursor = conn.cursor()

    # 示例：查询几个典型词汇
    test_words = ['accomplish', 'take', 'resilience', 'albeit', 'ubiquitous']
    for word in test_words:
        cursor.execute("""
            SELECT word, cefr_level, coca_rank, definition_cn,
                   is_toefl, is_ielts, is_gre
            FROM words WHERE word = ?
        """, (word,))
        row = cursor.fetchone()
        if row:
            exams = []
            if row[4]: exams.append('TOEFL')
            if row[5]: exams.append('IELTS')
            if row[6]: exams.append('GRE')
            print(f"\n  {row[0]}:")
            print(f"    CEFR: {row[1] or 'N/A'}, COCA: {row[2] or 'N/A'}")
            print(f"    中文: {row[3][:50] if row[3] else 'N/A'}...")
            print(f"    考试: {', '.join(exams) if exams else 'None'}")

    conn.close()


if __name__ == "__main__":
    main()
