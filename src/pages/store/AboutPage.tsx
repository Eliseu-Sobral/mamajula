import { Sparkles, Heart, Award, Users } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="page-enter max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="font-display text-4xl md:text-5xl font-semibold text-neutral-800 mb-4">
          Sobre a Mamajula
        </h1>
        <div className="divider-ornament max-w-xs mx-auto mb-6">✦</div>
        <p className="text-lg text-neutral-600 leading-relaxed">
          Nascemos da paixão por fragrâncias e da vontade de tornar perfumes de qualidade
          acessíveis a todos os brasileiros.
        </p>
      </div>

      <div className="prose prose-lg max-w-none">
        <p className="text-neutral-600 leading-relaxed mb-6">
          A Mamajula é uma perfumaria digital que conecta você aos melhores perfumes do mercado —
          nacionais, importados e árabes — com preços até 70% menores que o varejo tradicional.
          Trabalhamos apenas com produtos originais e oferecemos envio rastreado para todo Brasil.
        </p>
        <p className="text-neutral-600 leading-relaxed mb-10">
          Nossa missão é simples: democratizar o acesso a fragrâncias premium, com transparência,
          agilidade e atendimento próximo. Cada cliente é único, e tratamos seu pedido com o
          cuidado que ele merece.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
        {[
          { icon: Sparkles, value: '5 anos', label: 'De experiência' },
          { icon: Users, value: '10mil+', label: 'Clientes felizes' },
          { icon: Award, value: '500+', label: 'Fragrâncias' },
          { icon: Heart, value: '100%', label: 'Originais' },
        ].map((s) => (
          <div key={s.label} className="text-center p-6 bg-white rounded-xl3 shadow-card">
            <div className="inline-flex p-3 rounded-xl bg-primary-50 text-primary-600 mb-3">
              <s.icon className="w-6 h-6" />
            </div>
            <p className="font-display text-2xl font-semibold text-neutral-800">{s.value}</p>
            <p className="text-sm text-neutral-500">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
