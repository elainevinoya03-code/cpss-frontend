import React, { useState } from 'react';
import { ChevronDown, Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react';
import { Button } from '../components/ui/button';

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
    message: '',
  });
  const [charCount, setCharCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'message') {
      setCharCount(value.length);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      console.log('Form submitted:', formData);
      setIsSubmitting(false);
      setFormData({ name: '', email: '', subject: '', message: '' });
      setCharCount(0);
      alert('Message sent successfully!');
    }, 1500);
  };

  const inputSurface =
    'mt-2 rounded-2xl border border-border bg-muted p-3 transition-colors focus-within:border-primary/50';

  const inputClass =
    'w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/60';

  return (
    <section id="contact" className="scroll-mt-28 border-t border-border bg-muted/35 lg:scroll-mt-32" aria-labelledby="contact-title">
      <div className="mx-auto w-full max-w-[100rem] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <span className="section-label">Contact Us</span>
          <h2 id="contact-title" className="mt-3 font-display text-4xl font-black leading-tight sm:text-5xl">
            Get <span className="text-primary">in Touch</span>
          </h2>
          <p className="mt-4 text-base leading-8 text-muted-foreground sm:text-lg">
            Have a question, concern, or suggestion? Reach out to us — we&apos;re here to help.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <div data-reveal className="rounded-3xl border border-border bg-card/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <MessageCircle className="size-6" aria-hidden="true" />
              </span>
              <h3 className="font-display text-xl font-extrabold">Send us a message</h3>
            </div>

            <form className="mt-8 flex flex-col gap-5" id="contactForm" onSubmit={handleSubmit}>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="contactName" className="text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
                    Full Name
                  </label>
                  <div className={inputSurface}>
                    <input
                      type="text"
                      id="contactName"
                      name="name"
                      className={inputClass}
                      placeholder="Juan dela Cruz"
                      required
                      value={formData.name}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="contactEmail" className="text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
                    Email Address
                  </label>
                  <div className={inputSurface}>
                    <input
                      type="email"
                      id="contactEmail"
                      name="email"
                      className={inputClass}
                      placeholder="juan@example.com"
                      required
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="contactSubject" className="text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
                  Subject
                </label>
                <div className={`${inputSurface} relative`}>
                  <select
                    id="contactSubject"
                    name="subject"
                    className={`${inputClass} cursor-pointer appearance-none pr-8`}
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
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                </div>
              </div>

              <div>
                <label htmlFor="contactMessage" className="text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
                  Message
                </label>
                <div className={inputSurface}>
                  <textarea
                    id="contactMessage"
                    name="message"
                    className={`${inputClass} min-h-[130px] resize-y`}
                    rows={5}
                    placeholder="Describe your concern in detail..."
                    maxLength={500}
                    required
                    value={formData.message}
                    onChange={handleChange}
                  />
                </div>
                <div className="mt-1.5 text-right text-xs font-semibold text-muted-foreground" id="charCount">
                  {charCount}/500
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send Message'}
                {!isSubmitting && <Send className="size-4" aria-hidden="true" />}
              </Button>
            </form>
          </div>

          <div data-reveal className="flex flex-col gap-6">
            <div className="flex items-start gap-4 rounded-3xl border border-border bg-card/95 p-6 shadow-2xl backdrop-blur-xl">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <MapPin className="size-5" aria-hidden="true" />
              </span>
              <div>
                <strong className="font-display text-base font-extrabold">Address</strong>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                  City Hall, 2nd Floor
                  <br />
                  Peace and Order Council Office
                </span>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-3xl border border-border bg-card/95 p-6 shadow-2xl backdrop-blur-xl">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Phone className="size-5" aria-hidden="true" />
              </span>
              <div>
                <strong className="font-display text-base font-extrabold">Phone</strong>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">(02) 1234-5678</span>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-3xl border border-border bg-card/95 p-6 shadow-2xl backdrop-blur-xl">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Mail className="size-5" aria-hidden="true" />
              </span>
              <div>
                <strong className="font-display text-base font-extrabold">Email</strong>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">cpss@lgu.gov.ph</span>
              </div>
            </div>

            <div className="min-h-[260px] flex-1 overflow-hidden rounded-3xl border border-border shadow-2xl">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3859.646237085629!2d121.0437914!3d14.6496857!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397b7a1b7a1b7a1%3A0x123456789abcdef!2sQuezon%20City%20Hall!5e0!3m2!1sen!2sph!4v1"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Map to our office"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;