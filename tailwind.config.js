/** @type {import('tailwindcss').Config} */
export default {
      content: ["./index.html", "./src/**/*.js"],
  darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace'],
          },
          colors: {
            studio: {
              bg: '#181A1F',
              panel: '#22252C',
              surface: '#2A2E37',
              border: '#343946',
              blender: '#E87D0D',
              blenderHover: '#FF9224',
              roblox: '#00A2FF',
              robloxHover: '#29B2FF',
            }
          }
        }
      }
    };
