import Navbar from './components/Navbar'
import Hero from './components/Hero'
import About from './components/About'
import Products from './components/Products'
import QuoteSimulator from './components/QuoteSimulator'
import RodStory from './components/RodStory'
import Benefits from './components/Benefits'
import Testimonials from './components/Testimonials'
import Contact from './components/Contact'
import Footer from './components/Footer'

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <About />
        <Products />
        <QuoteSimulator />
        <RodStory />
        <Benefits />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
    </div>
  )
}

export default App
