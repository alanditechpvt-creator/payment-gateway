'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  CreditCardIcon, 
  ShieldCheckIcon, 
  ChartBarIcon,
  UsersIcon,
  ArrowRightIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

const features = [
  {
    icon: CreditCardIcon,
    title: 'Multi-Gateway Support',
    description: 'Integrate with multiple payment gateways seamlessly. Switch between providers with zero downtime.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Enterprise Security',
    description: 'Bank-grade encryption and compliance. PCI-DSS certified infrastructure for your peace of mind.',
  },
  {
    icon: ChartBarIcon,
    title: 'Real-time Analytics',
    description: 'Track transactions, monitor commissions, and analyze performance with live dashboards.',
  },
  {
    icon: UsersIcon,
    title: 'Multi-level Hierarchy',
    description: 'Manage distributors, retailers, and white-label partners with flexible commission structures.',
  },
];

const stats = [
  { value: '₹50Cr+', label: 'Processed Monthly' },
  { value: '99.99%', label: 'Uptime' },
  { value: '10K+', label: 'Active Users' },
  { value: '4', label: 'Payment Gateways' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-mesh">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <SparklesIcon className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-display font-bold">PaymentGateway</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-white/60 hover:text-white transition-colors">
              Login
            </Link>
            <Link href="/login" className="btn-primary">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8">
              <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
              <span className="text-sm text-white/60">Trusted by 10,000+ businesses</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-display font-bold mb-6 leading-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-accent-400 to-primary-400 animate-gradient">
                Powerful Payment
              </span>
              <br />
              Infrastructure
            </h1>
            
            <p className="text-xl text-white/60 mb-10 max-w-2xl mx-auto">
              The complete payment gateway management platform for enterprises. 
              Handle payin, payout, and multi-level commissions with ease.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/login" className="btn-primary text-lg px-8 py-4">
                Start Free Trial
                <ArrowRightIcon className="w-5 h-5 ml-2" />
              </Link>
              <Link href="#features" className="btn-secondary text-lg px-8 py-4">
                Learn More
              </Link>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6"
          >
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className="stat-card text-center"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="text-3xl md:text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400">
                  {stat.value}
                </div>
                <div className="text-white/50 mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-display font-bold mb-4">
              Everything You Need
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              A complete suite of tools to manage your payment operations at scale.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="glass-card group hover:bg-white/10 transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-7 h-7 text-primary-400" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-white/60">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="gradient-border p-12 text-center"
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Ready to Transform Your Payments?
            </h2>
            <p className="text-xl text-white/60 mb-8">
              Join thousands of businesses processing payments with confidence.
            </p>
            <Link href="/login" className="btn-primary text-lg px-8 py-4">
              Get Started Now
              <ArrowRightIcon className="w-5 h-5 ml-2" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <SparklesIcon className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">PaymentGateway</span>
          </div>
          <p className="text-white/40 text-sm">
            © {new Date().getFullYear()} PaymentGateway. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

