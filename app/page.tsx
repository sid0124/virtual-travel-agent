import { Navigation } from "@/components/navigation"
import { SearchForm } from "@/components/search-form"
import { DestinationCard } from "@/components/destination-card"
import { ChatBubble } from "@/components/chat-bubble"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { destinations } from "@/lib/data"
import {
  Sparkles,
  Globe,
  Shield,
  Clock,
  ArrowRight,
  Plane,
  Hotel,
  MapPin,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Planning",
    description: "Get personalized trip recommendations based on your preferences and budget",
  },
  {
    icon: Globe,
    title: "Global Coverage",
    description: "Access thousands of destinations, hotels, and experiences worldwide",
  },
  {
    icon: Shield,
    title: "Trusted Reviews",
    description: "Real reviews from millions of travelers to help you decide",
  },
  {
    icon: Clock,
    title: "24/7 Assistance",
    description: "Our AI assistant is always ready to help with your travel needs",
  },
]

const stats = [
  { value: "500+", label: "Destinations" },
  { value: "10K+", label: "Hotels" },
  { value: "50K+", label: "Happy Travelers" },
  { value: "4.9", label: "App Rating" },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative mx-auto px-4 py-16 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-foreground">AI-Powered Travel Planning</span>
              </div>
              
              <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Go anywhere with{" "}
                <span className="text-primary">Wanderly</span>
              </h1>
              
              <p className="max-w-lg text-lg text-muted-foreground">
                Find great prices on flights and hotels, discover must-see sights,
                and plan your ideal trip - all with AI-powered assistance.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link href="/chat">
                  <Button size="lg" className="gap-2">
                    <Sparkles className="h-5 w-5" />
                    Plan My Trip with AI
                  </Button>
                </Link>
                <Link href="/destinations">
                  <Button size="lg" variant="outline" className="gap-2 bg-transparent">
                    Explore Destinations
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap gap-8 pt-4">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero Image Grid */}
            <div className="relative hidden lg:block">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-2xl">
                    <Image
                      src="https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=600&q=80"
                      alt="Paris"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="relative aspect-square overflow-hidden rounded-2xl">
                    <Image
                      src="https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80"
                      alt="Tokyo"
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
                <div className="space-y-4 pt-8">
                  <div className="relative aspect-square overflow-hidden rounded-2xl">
                    <Image
                      src="https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80"
                      alt="Bali"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="relative aspect-[3/4] overflow-hidden rounded-2xl">
                    <Image
                      src="https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=600&q=80"
                      alt="Santorini"
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              </div>
              
              {/* Floating Card */}
              <Card className="absolute -left-8 bottom-24 w-64 shadow-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Plane className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Trip Planned!</p>
                      <p className="text-sm text-muted-foreground">Paris, 5 days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Search Section */}
      <section className="relative -mt-4 pb-16">
        <div className="container mx-auto px-4">
          <SearchForm />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground">
              Why Choose Wanderly
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Experience the future of travel planning with our AI-powered platform
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <Card key={feature.title} className="border-0 bg-secondary/50">
                  <CardContent className="p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mb-2 font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Popular Destinations */}
      <section className="bg-secondary/30 py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="mb-12 flex items-center justify-between">
            <div>
              <h2 className="mb-2 text-3xl font-bold text-foreground">
                Discover Trending Destinations
              </h2>
              <p className="text-muted-foreground">
                Explore popular places loved by travelers worldwide
              </p>
            </div>
            <Link href="/destinations" className="hidden sm:block">
              <Button variant="outline" className="gap-2 bg-transparent">
                View All
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {destinations.slice(0, 4).map((destination) => (
              <DestinationCard key={destination.id} {...destination} />
            ))}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Link href="/destinations">
              <Button variant="outline" className="gap-2 bg-transparent">
                View All Destinations
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground">
              Plan Your Trip in Minutes
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Our AI assistant makes travel planning effortless
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                icon: MapPin,
                title: "Tell Us Your Dream",
                description: "Share your destination preferences, dates, and budget with our AI",
              },
              {
                step: "02",
                icon: Sparkles,
                title: "Get AI Recommendations",
                description: "Receive personalized itineraries, hotels, and activities",
              },
              {
                step: "03",
                icon: Hotel,
                title: "Book & Travel",
                description: "Confirm your bookings and enjoy a seamless travel experience",
              },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.step} className="relative text-center">
                  <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                    <Icon className="h-8 w-8 text-primary" />
                  </div>
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-5xl font-bold text-primary/10">
                    {item.step}
                  </span>
                  <h3 className="mb-2 text-xl font-semibold text-foreground">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary py-16 lg:py-24">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold text-primary-foreground">
            Ready to Start Your Adventure?
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-primary-foreground/80">
            Let our AI travel assistant help you create unforgettable memories
          </p>
          <Link href="/chat">
            <Button size="lg" variant="secondary" className="gap-2">
              <Sparkles className="h-5 w-5" />
              Start Planning Now
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <Link href="/" className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                  <Plane className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold text-foreground">Wanderly</span>
              </Link>
              <p className="mt-4 text-sm text-muted-foreground">
                Your AI-powered travel companion for planning perfect trips.
              </p>
            </div>
            
            <div>
              <h4 className="mb-4 font-semibold text-foreground">Explore</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/destinations" className="hover:text-foreground">Destinations</Link></li>
                <li><Link href="/booking" className="hover:text-foreground">Hotels</Link></li>
                <li><Link href="/booking" className="hover:text-foreground">Flights</Link></li>
                <li><Link href="/itinerary" className="hover:text-foreground">Itineraries</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="mb-4 font-semibold text-foreground">Features</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/chat" className="hover:text-foreground">AI Assistant</Link></li>
                <li><Link href="/budget" className="hover:text-foreground">Budget Planner</Link></li>
                <li><Link href="/weather" className="hover:text-foreground">Weather Info</Link></li>
                <li><Link href="/profile" className="hover:text-foreground">Trip History</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="mb-4 font-semibold text-foreground">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Help Center</a></li>
                <li><a href="#" className="hover:text-foreground">Contact Us</a></li>
                <li><a href="#" className="hover:text-foreground">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
            <p>2026 Wanderly. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <ChatBubble />
    </div>
  )
}
