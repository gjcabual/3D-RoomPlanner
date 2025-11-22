/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./js/**/*.js",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Background colors
        'bg-primary': '#0a0a0a',
        'bg-secondary': '#1a1a1a',
        'bg-surface': 'rgba(15, 15, 15, 0.96)',
        'bg-overlay': 'rgba(0, 0, 0, 0.7)',
        'bg-panel': 'rgba(15, 15, 15, 0.96)',
        'bg-card': 'rgba(255, 255, 255, 0.05)',
        'bg-hover': 'rgba(255, 255, 255, 0.1)',
        'bg-active': 'rgba(255, 255, 255, 0.15)',
        
        // Text colors
        'text-primary': '#ffffff',
        'text-secondary': '#f5f5f5',
        'text-muted': 'rgba(255, 255, 255, 0.7)',
        'text-disabled': 'rgba(255, 255, 255, 0.4)',
        
        // Border colors
        'border-default': 'rgba(255, 255, 255, 0.08)',
        'border-hover': 'rgba(255, 255, 255, 0.15)',
        'border-active': 'rgba(255, 255, 255, 0.25)',
        'border-strong': 'rgba(255, 255, 255, 0.3)',
        
        // Accent colors
        'accent-success': '#4CAF50',
        'accent-success-hover': '#45a049',
        'accent-warning': '#ff9800',
        'accent-error': '#f44336',
        'accent-error-hover': '#d32f2f',
        'accent-info': '#2196F3',
        'accent-orange': '#FF8C00',
        'accent-green': '#4CAF50',
        'accent-red': '#FF6B6B',
      },
      spacing: {
        // Custom spacing scale based on 4px unit
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'base': '16px',
        'lg': '20px',
        'xl': '24px',
        '2xl': '32px',
        '3xl': '40px',
        '4xl': '48px',
        '5xl': '64px',
      },
      fontFamily: {
        'sans': ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', '"Roboto"', '"Oxygen"', '"Ubuntu"', '"Cantarell"', '"Fira Sans"', '"Droid Sans"', '"Helvetica Neue"', 'sans-serif'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1.5' }],
        'sm': ['0.875rem', { lineHeight: '1.5' }],
        'base': ['1rem', { lineHeight: '1.5' }],
        'lg': ['1.125rem', { lineHeight: '1.5' }],
        'xl': ['1.25rem', { lineHeight: '1.5' }],
        '2xl': ['1.5rem', { lineHeight: '1.25' }],
        '3xl': ['1.875rem', { lineHeight: '1.25' }],
        '4xl': ['2.25rem', { lineHeight: '1.25' }],
      },
      boxShadow: {
        'sm': '0 1px 3px rgba(0, 0, 0, 0.3)',
        'md': '0 4px 20px rgba(0, 0, 0, 0.3)',
        'lg': '0 10px 30px rgba(0, 0, 0, 0.35)',
        'xl': '0 20px 45px rgba(0, 0, 0, 0.35)',
        '2xl': '0 25px 50px rgba(0, 0, 0, 0.4)',
        'colored': '0 10px 30px rgba(255, 255, 255, 0.2)',
        'panel': '2px 0 20px rgba(0, 0, 0, 0.5)',
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '10px',
        'xl': '12px',
        '2xl': '16px',
      },
      backdropBlur: {
        'sm': '4px',
        'md': '10px',
        'lg': '20px',
      },
      zIndex: {
        'dropdown': '1000',
        'sticky': '1020',
        'fixed': '1030',
        'modal-backdrop': '1040',
        'modal': '1050',
        'popover': '1060',
        'tooltip': '1070',
        'side-panel': '1500',
        'resize-panel': '1501',
        'sources-panel': '1300',
        'furniture-control': '2000',
        'drop-indicator': '2500',
        'dialog': '10001',
        'auth-modal': '10000',
      },
    },
  },
  plugins: [],
}

