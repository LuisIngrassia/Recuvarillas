import Navbar from './components/Navbar'
import Hero from './components/Hero'
import About from './components/About'
import Products from './components/Products'
import QuoteSimulator from './components/QuoteSimulator'
import RodStory from './components/RodStory'
import Testimonials from './components/Testimonials'
import Contact from './components/Contact'
import Footer from './components/Footer'

/** La web pública. Lo que había en `App.jsx` antes de que el ERP le pusiera rutas. */
function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Products />
        <QuoteSimulator />
        <RodStory />
        <About />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
    </div>
  )
}

export default Landing
