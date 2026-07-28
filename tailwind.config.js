export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#08111f',
        'bg-alt': '#0e1a30',
        panel: 'rgba(14, 26, 48, 0.82)',
        'panel-strong': 'rgba(9, 15, 28, 0.92)',
        text: '#eef4ff',
        muted: '#a7b8d8',
        line: 'rgba(176, 199, 255, 0.18)',
        accent: '#8ef2d0',
        'accent-strong': '#6ae6ff',
      },
      boxShadow: {
        'custom': '0 24px 80px rgba(0, 0, 0, 0.35)',
      },
      borderRadius: {
        'lg': '24px',
        'md': '16px',
        'sm': '14px',
      },
    },
  },
  plugins: [],
}