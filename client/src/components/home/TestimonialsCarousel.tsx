import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
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
  const [visibleLogos, setVisibleLogos] = useState<boolean[]>([]);

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

  // Initialize visibility array on component mount
  useEffect(() => {
    const visibleCount = window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1;
    setVisibleLogos(new Array(visibleCount).fill(false));
  }, []);

  // Staggered animation for testimonial cards
  useEffect(() => {
    const visibleCount = window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1;
    const newVisible = new Array(visibleCount).fill(false);

    newVisible.forEach((_, i) => {
      setTimeout(() => {
        setVisibleLogos(prev => {
          const updated = [...prev];
          updated[i] = true;
          return updated;
        });
      }, i * 120);
    });
  }, [currentIndex]);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    setDisplayedRatings({});
    setVisibleLogos(visibleLogos.map(() => false));
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
    setDisplayedRatings({});
    setVisibleLogos(visibleLogos.map(() => false));
  };

  const currentTestimonial = testimonials[currentIndex];
  const visibleTestimonials = [
    testimonials[currentIndex],
    testimonials[(currentIndex + 1) % testimonials.length],
    testimonials[(currentIndex + 2) % testimonials.length]
  ].filter((_, i) => i < (window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1));

  return (
    <section
      className="py-24 px-4 relative overflow-hidden"
      style={{
        backgroundImage: 'url(https://www.mcrepair.de/bilder/home/banner/fakten_bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Professional overlay with gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/50"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/20 to-transparent"></div>

      {/* Content wrapper */}
      <div className="relative z-10 container mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <div className="inline-block mb-3 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 hover:bg-white/15 transition-all duration-300">
            <span className="text-xs font-semibold text-white">⭐ {t('home.testimonials.featured') || 'Customer Reviews'}</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 drop-shadow-lg">
            {title || t('home.testimonials.title')}
          </h2>
          <p className="text-gray-100 text-base max-w-2xl mx-auto drop-shadow-md">
            {t('home.testimonials.subtitle')}
          </p>
        </div>

        {/* Testimonials Carousel */}
        <div className="relative max-w-6xl mx-auto">
          {/* Main Testimonial Display */}
          <div className="mb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleTestimonials.map((testimonial, index) => (
                <div
                  key={index}
                  style={{
                    opacity: visibleLogos[index] ? 1 : 0,
                    transform: visibleLogos[index] ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
                    transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }}
                >
                  <Card className="h-full bg-white/95 backdrop-blur-sm border-0 shadow-2xl hover:shadow-3xl transition-all duration-400 group hover:-translate-y-2 relative overflow-hidden">
                    {/* Top accent line */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-orange-400 to-transparent transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>

                    {/* Quote icon background */}
                    <div className="absolute -top-12 -right-12 opacity-5 group-hover:opacity-8 transition-opacity duration-300">
                      <Quote className="w-40 h-40 text-gray-800" />
                    </div>

                    <CardContent className="p-8 relative z-10">
                      {/* Stars with animation */}
                      <div className="flex gap-1 mb-6">
                        {Array.from({ length: testimonial.rating }).map((_, i) => (
                          <div
                            key={i}
                            style={{
                              opacity: Object.keys(displayedRatings).includes(String(i)) ? 1 : 0,
                              transform: Object.keys(displayedRatings).includes(String(i)) ? 'scale(1) rotate(0deg)' : 'scale(0) rotate(-180deg)',
                              transition: `all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 80}ms`
                            }}
                          >
                            <Star className="w-5 h-5 fill-yellow-400 text-yellow-400 drop-shadow-md" />
                          </div>
                        ))}
                      </div>

                      {/* Comment */}
                      <p className="text-gray-700 text-base mb-6 leading-relaxed font-medium group-hover:text-gray-800 transition-colors duration-300">
                        "{testimonial.comment}"
                      </p>

                      {/* Animated divider */}
                      <div className="flex items-center gap-2 mb-6">
                        <div className="flex-1 h-1 bg-gradient-to-r from-yellow-300 to-yellow-100 rounded-full"></div>
                        <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></div>
                      </div>

                      {/* Author Info with enhanced styling */}
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-r from-yellow-300 to-orange-300 rounded-full blur opacity-0 group-hover:opacity-60 transition-opacity duration-300"></div>
                          <Avatar className="h-12 w-12 relative border-2 border-white shadow-lg">
                            <AvatarImage src={testimonial.avatar} alt={testimonial.name} />
                            <AvatarFallback className="bg-gradient-to-br from-yellow-400 to-orange-400 text-white font-bold">
                              {testimonial.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 group-hover:text-yellow-700 transition-colors duration-300">{testimonial.name}</p>
                          {testimonial.role && (
                            <p className="text-sm text-gray-600">{testimonial.role}</p>
                          )}
                          {testimonial.company && (
                            <p className="text-xs text-gray-500">{testimonial.company}</p>
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
          <div className="flex items-center justify-center gap-6 mt-12">
            {/* Previous Button */}
            <button
              onClick={prevTestimonial}
              className="p-3 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 border border-white/30"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Indicators */}
            <div className="flex gap-3">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentIndex(index);
                    setDisplayedRatings({});
                    setVisibleLogos(visibleLogos.map(() => false));
                  }}
                  className={`rounded-full transition-all duration-500 ${
                    index === currentIndex
                      ? 'bg-white/80 w-8 h-3 shadow-lg'
                      : 'bg-white/30 w-3 h-3 hover:bg-white/50'
                  }`}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>

            {/* Next Button */}
            <button
              onClick={nextTestimonial}
              className="p-3 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 border border-white/30"
              aria-label="Next testimonial"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Counter with enhanced styling */}
          <div className="text-center mt-8">
            <p className="text-sm font-semibold text-white/90 bg-white/10 backdrop-blur-md inline-block px-4 py-2 rounded-full border border-white/20">
              {currentIndex + 1} <span className="text-white/70">/</span> {testimonials.length}
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

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes rotateIn {
          from {
            opacity: 0;
            transform: rotate(-180deg) scale(0);
          }
          to {
            opacity: 1;
            transform: rotate(0deg) scale(1);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out forwards;
        }

        .animate-scaleIn {
          animation: scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .animate-slideInUp {
          animation: slideInUp 0.6s ease-out forwards;
        }

        .animate-slideInDown {
          animation: slideInDown 0.6s ease-out forwards;
        }

        .animate-rotateIn {
          animation: rotateIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
    </section>
  );
}
