'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, MapPin, Shield, Briefcase, ArrowRight, ChevronDown } from 'lucide-react';

const features = [
  {
    icon: Camera,
    title: 'Face Recognition',
    description: 'Secure, contactless clock-in using facial biometrics with anti-spoofing liveness detection.',
  },
  {
    icon: MapPin,
    title: 'Geo-fencing',
    description: 'Ensure attendance is only captured from approved locations with precision boundary detection.',
  },
  {
    icon: Shield,
    title: 'Live Map',
    description: 'Real-time visibility of clocked-in employees across sites with interactive mapping.',
  },
  {
    icon: Briefcase,
    title: 'Payroll Integration',
    description: 'Automated payroll calculations with overtime rules, breaks, and approval workflows.',
  },
];

export default function LandingPage() {
  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">FaceAttend</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <a href="/login">Sign In</a>
            </Button>
            <Button asChild>
              <a href="/login">Get Started</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-24 md:py-32 text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            Secure Facial Recognition
            <span className="text-primary block mt-2">Attendance</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Modern workforce attendance with biometric verification, geo-fencing, and
            real-time compliance monitoring.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <a href="/login">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button size="lg" variant="outline" onClick={scrollToFeatures}>
              Learn More <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>

        <section id="features" className="border-t bg-muted/50 py-16 md:py-24">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Everything you need</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((f) => (
                <Card key={f.title} className="border-0 shadow-md">
                  <CardHeader>
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                      <f.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle>{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm">{f.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} FaceAttend. All rights reserved.</p>
          <div className="flex justify-center gap-4 mt-2">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
