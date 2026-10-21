export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Sarabun', 'sans-serif'] },
      colors: {
        brand: { DEFAULT: '#0C7C82', light: '#35B4B0', soft: '#26A69A' },
        bg: { DEFAULT: '#070b14', card: '#0f1626', line: '#1e2a40' }
      }
    }
  },
  plugins: []
}
