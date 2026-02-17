/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#f5f5f5',       // Light gray background
        surface: '#ffffff',          // White cards
        'surface-hover': '#f0f0f0',  // Slightly darker on hover
        'surface-active': '#e5e5e5', // Even darker when active
        border: 'rgba(0, 0, 0, 0.08)',
        'border-hover': 'rgba(0, 0, 0, 0.12)',
        primary: '#1a1a1a',          // Dark text
        secondary: '#525252',        // Medium contrast text
        tertiary: '#a3a3a3',         // Low contrast text
        accent: '#5E6AD2',           // Keep Linear-like purple/blue
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['11px', '14px'],
        sm: ['13px', '18px'],
        base: ['14px', '20px'],
        lg: ['16px', '24px'],
        xl: ['20px', '28px'],
      },
      boxShadow: {
        'glass': '0 8px 30px rgba(0, 0, 0, 0.12)',
        'glass-sm': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'glow': '0 0 20px rgba(94, 106, 210, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      }
    },
  },
  plugins: [],
}
