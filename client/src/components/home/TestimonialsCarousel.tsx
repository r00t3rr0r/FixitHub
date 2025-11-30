import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Testimonial {
  _id?: string;
  name: string;
  role?: string;
  avatar?: string;
  rating: number;
  comment: string;
  company?: string;
}

interface TestimonialsCarouselProps {
  title?: string;
  testimonials?: Testimonial[];
}

export function TestimonialsCarousel({
  title,
  testimonials: initialTestimonials
}: TestimonialsCarouselProps) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayedRatings, setDisplayedRatings] = useState<{ [key: number]: number }>({});

  const defaultTestimonials: Testimonial[] = [
    {
      name: 'Sarah Johnson',
      role: 'Business Owner',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
      rating: 5,
      comment: t('home.testimonials.sarah'),
      company: 'Tech Startup Inc.'
    },
    {
      name: 'Mike Chen',
      role: 'Student',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike',
      rating: 5,
      comment: t('home.testimonials.mike'),
      company: 'University of Tech'
    },
    {
      name: 'Emily Davis',
      role: 'Teacher',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emily',
      rating: 5,
      comment: t('home.testimonials.emily'),
      company: 'Lincoln High School'
    },
    {
      name: 'John Martinez',
      role: 'Freelancer',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
      rating: 5,
      comment: t('home.testimonials.john'),
      company: 'Self Employed'
    },
    {
      name: 'Lisa Wong',
      role: 'Manager',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lisa',
      rating: 5,
      comment: t('home.testimonials.lisa'),
      company: 'Fortune 500 Corp'
    }
  ];

  const testimonials = initialTestimonials || defaultTestimonials;

  // Animate star ratings when testimonial changes
  useEffect(() => {
    const timer = setTimeout(() => {
      const newRatings: { [key: number]: number } = {};
      for (let i = 0; i < testimonials[currentIndex].rating; i++) {
        newRatings[i] = i;
      }
      setDisplayedRatings(newRatings);
    }, 100);

    return () => clearTimeout(timer);
  }, [currentIndex, testimonials]);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    setDisplayedRatings({});
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
    setDisplayedRatings({});
  };

  const currentTestimonial = testimonials[currentIndex];
  const visibleTestimonials = [
    testimonials[currentIndex],
    testimonials[(currentIndex + 1) % testimonials.length],
    testimonials[(currentIndex + 2) % testimonials.length]
  ].filter((_, i) => i < (window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1));

  return (
    <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {title || t('home.testimonials.title')}
          </h2>
          <p className="text-gray-600 text-lg">
            {t('home.testimonials.subtitle')}
          </p>
        </div>

        {/* Testimonials Carousel */}
        <div className="relative max-w-6xl mx-auto">
          {/* Main Testimonial Display */}
          <div className="mb-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleTestimonials.map((testimonial, index) => (
                <div key={index} className="opacity-0 animate-fadeIn" style={{ animationDelay: `${index * 100}ms` }}>
                  <Card className="h-full shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                    <CardContent className="p-8">
                      {/* Stars */}
                      <div className="flex gap-1 mb-6">
                        {Array.from({ length: testimonial.rating }).map((_, i) => (
                          <div
                            key={i}
                            className="opacity-0 animate-scaleIn"
                            style={{ animationDelay: `${i * 100}ms` }}
                          >
                            <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                          </div>
                        ))}
                      </div>

                      {/* Comment */}
                      <p className="text-gray-700 text-lg mb-6 italic leading-relaxed">
                        "{testimonial.comment}"
                      </p>

                      {/* Divider */}
                      <div className="w-12 h-1 bg-yellow-400 rounded-full mb-6"></div>

                      {/* Author Info */}
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={testimonial.avatar} alt={testimonial.name} />
                          <AvatarFallback>{testimonial.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900">{testimonial.name}</p>
                          {testimonial.role && (
                            <p className="text-sm text-gray-600">{testimonial.role}</p>
                          )}
                          {testimonial.company && (
                            <p className="text-sm text-gray-500">{testimonial.company}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-center gap-4">
            {/* Previous Button */}
            <button
              onClick={prevTestimonial}
              className="p-3 rounded-full bg-yellow-400 text-gray-900 hover:bg-yellow-500 transition-all duration-300 hover:scale-110 shadow-lg"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Indicators */}
            <div className="flex gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`h-3 rounded-full transition-all duration-300 ${
                    index === currentIndex ? 'bg-yellow-400 w-8' : 'bg-gray-300 w-3'
                  }`}
                />
              ))}
            </div>

            {/* Next Button */}
            <button
              onClick={nextTestimonial}
              className="p-3 rounded-full bg-yellow-400 text-gray-900 hover:bg-yellow-500 transition-all duration-300 hover:scale-110 shadow-lg"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Counter */}
          <div className="text-center mt-8 text-gray-600">
            <p>
              {currentIndex + 1} {t('home.testimonials.of')} {testimonials.length}
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.5);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }

        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out forwards;
        }
      `}</style>
    </section>
  );
}
