import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import { AppRouter } from './router'
import '@lottiefiles/dotlottie-wc'

const container = document.getElementById('root')
if (!container) throw new Error('Root element not found')
const root = createRoot(container)
root.render(<AppRouter />)


