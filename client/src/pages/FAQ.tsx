import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TopBar } from '@/components/home/TopBar';
import { McRepairNav } from '@/components/home/McRepairNav';
import { Footer } from '@/components/Footer';
import { CookieBanner } from '@/components/CookieBanner';
import { getFAQs, FAQ as FAQType } from '@/api/faq';
import { 
  HelpCircle, 
  ChevronDown, 
  Search,
  Loader2
} from 'lucide-react';
import './FAQ.css';

export function FAQ() {
  const { t } = useTranslation();
  const [groupedFAQs, setGroupedFAQs] = useState<Record<string, FAQType[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedFAQs, setExpandedFAQs] = useState<Set<string>>(new Set());

  const categories = [
    { value: 'all', label: t('faq.allCategories') },
    { value: 'General', label: t('faq.categories.general') },
    { value: 'Repairs', label: t('faq.categories.repairs') },
    { value: 'Pricing', label: t('faq.categories.pricing') },
    { value: 'Warranty', label: t('faq.categories.warranty') },
    { value: 'Shipping', label: t('faq.categories.shipping') },
    { value: 'Account', label: t('faq.categories.account') },
    { value: 'Technical', label: t('faq.categories.technical') }
  ];

  useEffect(() => {
    fetchFAQs();
  }, [selectedCategory, searchTerm]);

  const fetchFAQs = async () => {
    try {
      setLoading(true);
      const filters = {
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        search: searchTerm || undefined,
        isActive: true
      };

      const response = await getFAQs(filters);
      setGroupedFAQs(response.groupedFAQs || {});
    } catch (error) {
      console.error('Error fetching FAQs:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFAQ = (faqId: string) => {
    setExpandedFAQs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(faqId)) {
        newSet.delete(faqId);
      } else {
        newSet.add(faqId);
      }
      return newSet;
    });
  };

  return (
    <div className="faq-page">
      <TopBar />
      <McRepairNav />

      {/* Hero Section */}
      <section className="faq-hero">
        <div className="faq-hero-content">
          <div className="faq-hero-icon">
            <HelpCircle className="w-16 h-16 text-white" />
          </div>
          <h1 className="faq-hero-title">{t('faq.title')}</h1>
          <p className="faq-hero-subtitle">{t('faq.subtitle')}</p>
        </div>
      </section>

      {/* Search and Filter Section */}
      <section className="faq-container">
        <div className="faq-search-section">
          <div className="faq-search-wrapper">
            <Search className="faq-search-icon" />
            <input
              type="text"
              placeholder={t('faq.searchPlaceholder')}
              className="faq-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="faq-category-pills">
            {categories.map((category) => (
              <button
                key={category.value}
                className={`faq-category-pill ${selectedCategory === category.value ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category.value)}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        {/* FAQ List */}
        <div className="faq-content">
          {loading ? (
            <div className="faq-loading">
              <Loader2 className="h-8 w-8 animate-spin text-mcrepair-accent" />
              <p>{t('faq.loading')}</p>
            </div>
          ) : Object.keys(groupedFAQs).length === 0 ? (
            <div className="faq-empty">
              <HelpCircle className="h-16 w-16 text-mcrepair-gray-300" />
              <h3>{t('faq.noResults')}</h3>
              <p>{t('faq.tryDifferentSearch')}</p>
            </div>
          ) : (
            Object.entries(groupedFAQs).map(([category, categoryFAQs]) => (
              <div key={category} className="faq-category-section">
                <div className="faq-category-header">
                  <h2 className="faq-category-title">{category}</h2>
                  <span className="faq-category-count">
                    {categoryFAQs.length} {categoryFAQs.length === 1 ? t('faq.question') : t('faq.questions')}
                  </span>
                </div>

                <div className="faq-accordion">
                  {categoryFAQs.map((faq) => {
                    const isExpanded = expandedFAQs.has(faq._id);
                    return (
                      <div
                        key={faq._id}
                        className={`faq-item ${isExpanded ? 'expanded' : ''}`}
                      >
                        <button
                          className="faq-question"
                          onClick={() => toggleFAQ(faq._id)}
                          aria-expanded={isExpanded}
                        >
                          <span className="faq-question-text">{faq.question}</span>
                          <ChevronDown
                            className={`faq-chevron ${isExpanded ? 'rotated' : ''}`}
                          />
                        </button>

                        <div className={`faq-answer ${isExpanded ? 'show' : ''}`}>
                          <div className="faq-answer-content">
                            <p>{faq.answer}</p>
                            {faq.tags && faq.tags.length > 0 && (
                              <div className="faq-tags">
                                {faq.tags.map((tag, index) => (
                                  <span key={index} className="faq-tag">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Help Section */}
        <div className="faq-help-section">
          <div className="faq-help-card">
            <h3>{t('faq.stillNeedHelp')}</h3>
            <p>{t('faq.contactSupport')}</p>
            <div className="faq-help-buttons">
              <a href="tel:+4912345678" className="faq-help-btn primary">
                {t('faq.callUs')}
              </a>
              <a href="/contact" className="faq-help-btn secondary">
                {t('faq.contactForm')}
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <CookieBanner />
    </div>
  );
}
