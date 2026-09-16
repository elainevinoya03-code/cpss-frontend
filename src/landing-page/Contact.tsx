import React, { useState } from 'react';

interface FormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const Contact: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [charCount, setCharCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'message') {
      setCharCount(value.length);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    setTimeout(() => {
      console.log('Form submitted:', formData);
      setIsSubmitting(false);
      setFormData({ name: '', email: '', subject: '', message: '' });
      setCharCount(0);
      alert('Message sent successfully!');
    }, 1500);
  };

  return (
    <section className="contact-section" id="contact" aria-labelledby="contact-title">
      <div className="contact-bg-decor" aria-hidden="true"></div>
      <div className="container reveal">
        <div className="section-header">
          <span className="eyebrow">CONTACT US</span>
          <h2 className="section-heading" id="contact-title">Get In Touch</h2>
          <p className="contact-subtitle">Have a question, concern, or suggestion? Reach out to us — we're here to help.</p>
        </div>
        <div className="contact-grid">
          <div className="contact-form-wrap">
            <div className="contact-form-header">
              <svg className="contact-form-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span>Send us a message</span>
            </div>
            <form className="contact-form" id="contactForm" onSubmit={handleSubmit}>
              <div className="contact-form-row">
                <div className="contact-form-group">
                  <label htmlFor="contactName" className="contact-label">Full Name</label>
                  <input 
                    type="text" 
                    id="contactName" 
                    name="name" 
                    className="contact-input" 
                    placeholder="Juan dela Cruz" 
                    required
                    value={formData.name}
                    onChange={handleChange}
                  />
                </div>
                <div className="contact-form-group">
                  <label htmlFor="contactEmail" className="contact-label">Email Address</label>
                  <input 
                    type="email" 
                    id="contactEmail" 
                    name="email" 
                    className="contact-input" 
                    placeholder="juan@example.com" 
                    required
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="contact-form-group">
                <label htmlFor="contactSubject" className="contact-label">Subject</label>
                <select 
                  id="contactSubject" 
                  name="subject" 
                  className="contact-input contact-select" 
                  required
                  value={formData.subject}
                  onChange={handleChange}
                >
                  <option value="">Select a topic...</option>
                  <option value="report">Report an Incident</option>
                  <option value="inquiry">General Inquiry</option>
                  <option value="suggestion">Suggestion</option>
                  <option value="complaint">Complaint</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="contact-form-group">
                <label htmlFor="contactMessage" className="contact-label">Message</label>
                <textarea 
                  id="contactMessage" 
                  name="message" 
                  className="contact-input contact-textarea" 
                  rows={5} 
                  placeholder="Describe your concern in detail..." 
                  maxLength={500} 
                  required
                  value={formData.message}
                  onChange={handleChange}
                />
                <span className="contact-charcount" id="charCount">
                  <span id="charCountNum">{charCount}</span>/500
                </span>
              </div>
              <button type="submit" className="contact-submit" disabled={isSubmitting}>
                <span className="btn-text">
                  SEND MESSAGE <span className="btn-arrow" aria-hidden="true">→</span>
                </span>
              </button>
            </form>
          </div>
          <div className="contact-side">
            <div className="contact-info-cards">
              <div className="contact-info-card">
                <div className="contact-info-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                </div>
                <div>
                  <strong>Address</strong>
                  <span>City Hall, 2nd Floor<br/>Peace and Order Council Office</span>
                </div>
              </div>
              <div className="contact-info-card">
                <div className="contact-info-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </div>
                <div>
                  <strong>Phone</strong>
                  <span>(02) 1234-5678</span>
                </div>
              </div>
              <div className="contact-info-card">
                <div className="contact-info-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <div>
                  <strong>Email</strong>
                  <span>cpss@lgu.gov.ph</span>
                </div>
              </div>
            </div>
            <div className="contact-map">
              <iframe 
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3859.646237085629!2d121.0437914!3d14.6496857!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397b7a1b7a1b7a1%3A0x123456789abcdef!2sQuezon%20City%20Hall!5e0!3m2!1sen!2sph!4v1" 
                width="100%" 
                height="100%" 
                style={{ border: 0 }} 
                allowFullScreen 
                loading="lazy" 
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;