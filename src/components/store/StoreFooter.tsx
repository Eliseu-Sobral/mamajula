import { Link } from 'react-router-dom';
import { Instagram, MessageCircle, Mail } from 'lucide-react';

export default function StoreFooter() {
  return (
    <footer className="bg-neutral-900 text-neutral-300 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img src="/image.png" alt="Mamajula" className="h-12 w-auto object-contain bg-white/5 rounded-lg p-1" />
              <span className="font-display text-2xl text-white">Mamajula</span>
            </div>
            <p className="text-sm text-neutral-400 max-w-md">
              Perfumes importados, árabes e nacionais com até 70% OFF. Qualidade garantida,
              envio para todo Brasil. Sua fragrância favorita com o melhor preço.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Navegação</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/catalogo" className="hover:text-primary-400 transition-colors">Catálogo</Link></li>
              <li><Link to="/catalogo/promocoes" className="hover:text-primary-400 transition-colors">Promoções</Link></li>
              <li><Link to="/sobre" className="hover:text-primary-400 transition-colors">Sobre nós</Link></li>
              <li><Link to="/admin" className="hover:text-primary-400 transition-colors">Painel Admin</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Contato</h4>
            <div className="flex gap-3">
              <a href="#" className="p-2 rounded-lg bg-neutral-800 hover:bg-primary-600 transition-colors" aria-label="Instagram">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="p-2 rounded-lg bg-neutral-800 hover:bg-primary-600 transition-colors" aria-label="WhatsApp">
                <MessageCircle className="w-5 h-5" />
              </a>
              <a href="#" className="p-2 rounded-lg bg-neutral-800 hover:bg-primary-600 transition-colors" aria-label="Email">
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-800 mt-10 pt-6 text-center text-xs text-neutral-500">
          © {new Date().getFullYear()} Mamajula Perfumaria. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
