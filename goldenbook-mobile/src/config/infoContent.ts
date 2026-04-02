/**
 * infoContent.ts
 *
 * Static multilingual content for the profile Information screens.
 * Each page key maps to a LocalizedInfoPageContent object with per-locale
 * variants. Consumers pick content[locale] ?? content.en.
 */

export interface EditorialPageContent {
  type: 'editorial';
  title: string;
  subtitle: string;
  body: string[];
}

export interface ContactPageContent {
  type: 'contact';
  title: string;
  subtitle: string;
  email: string;
  social: Array<{ label: string; url: string; icon: 'instagram' | 'facebook' }>;
}

export type InfoPageContent = EditorialPageContent | ContactPageContent;

export type LocalizedInfoPageContent = {
  en: InfoPageContent;
  pt: InfoPageContent;
  es: InfoPageContent;
};

export const INFO_CONTENT: Record<string, LocalizedInfoPageContent> = {
  about: {
    en: {
      type: 'editorial',
      title: 'About Goldenbook Go',
      subtitle: 'The curated city guide for the discerning traveller.',
      body: [
        'Goldenbook Go is a curated guide to the places that actually matter — the restaurants worth the detour, the viewpoints only locals know, the neighbourhood bars with no sign on the door.',
        'We believe meaningful travel experiences come from genuine knowledge, not algorithms. Every place in Goldenbook Go is selected by editors with deep roots in their cities.',
        'We started in Lisbon. We are expanding to Porto, the Algarve, and beyond.',
      ],
    },
    pt: {
      type: 'editorial',
      title: 'Sobre o Goldenbook Go',
      subtitle: 'O guia curado da cidade para o viajante exigente.',
      body: [
        'O Goldenbook Go é um guia curado dos lugares que realmente importam — os restaurantes que valem a deslocação, os miradouros que só os locais conhecem, os bares de bairro sem placa na porta.',
        'Acreditamos que as experiências de viagem mais significativas vêm de um conhecimento genuíno, não de algoritmos. Cada lugar no Goldenbook Go é selecionado por editores com raízes profundas nas suas cidades.',
        'Começámos em Lisboa. Estamos a expandir para o Porto, o Algarve e além.',
      ],
    },
    es: {
      type: 'editorial',
      title: 'Sobre Goldenbook Go',
      subtitle: 'La guía curada de ciudad para el viajero exigente.',
      body: [
        'Goldenbook Go es una guía curada de los lugares que realmente importan — restaurantes que merecen el desvío, miradores que solo conocen los locales y bares de barrio sin cartel en la puerta.',
        'Creemos que las experiencias de viaje más significativas nacen del conocimiento auténtico, no de algoritmos. Cada lugar en Goldenbook Go está seleccionado por editores con raíces profundas en sus ciudades.',
        'Empezamos en Lisboa. Nos estamos expandiendo a Oporto, Algarve y más allá.',
      ],
    },
  },

  privacy: {
    en: {
      type: 'editorial',
      title: 'Privacy Policy',
      subtitle: 'We keep your data simple and your experience clean.',
      body: [
        'Goldenbook Go collects only the data necessary to personalise your experience: your saved places, preferred city, and language setting. We do not sell your data.',
        'We use Supabase for secure authentication and data storage. Analytics are anonymised and never linked to your identity.',
        'To request deletion of your account and data, contact us at privacy@goldenbook.app.',
      ],
    },
    pt: {
      type: 'editorial',
      title: 'Política de Privacidade',
      subtitle: 'Mantemos os teus dados simples e a tua experiência limpa.',
      body: [
        'O Goldenbook Go recolhe apenas os dados necessários para personalizar a tua experiência: os teus lugares guardados, cidade preferida e preferência de idioma. Não vendemos os teus dados.',
        'Utilizamos o Supabase para autenticação segura e armazenamento de dados. As análises são anonimizadas e nunca associadas à tua identidade.',
        'Para solicitar a eliminação da tua conta e dados, contacta-nos em privacy@goldenbook.app.',
      ],
    },
    es: {
      type: 'editorial',
      title: 'Política de Privacidad',
      subtitle: 'Mantenemos tus datos simples y tu experiencia limpia.',
      body: [
        'Goldenbook Go recopila solo los datos necesarios para personalizar tu experiencia: tus lugares guardados, ciudad preferida y configuración de idioma. No vendemos tus datos.',
        'Usamos Supabase para autenticación segura y almacenamiento de datos. La analítica está anonimizada y nunca se vincula a tu identidad.',
        'Para solicitar la eliminación de tu cuenta y datos, contáctanos en privacy@goldenbook.app.',
      ],
    },
  },

  terms: {
    en: {
      type: 'editorial',
      title: 'Terms of Use',
      subtitle: 'Simple rules for using Goldenbook Go.',
      body: [
        'By using Goldenbook Go, you agree to use the app and website for personal, non-commercial purposes only.',
        'All editorial content — picks, routes, and descriptions — is the property of Goldenbook Go. You may share links, but reproduction without permission is not permitted.',
        'We reserve the right to update these terms. Continued use of the app constitutes acceptance of any changes.',
      ],
    },
    pt: {
      type: 'editorial',
      title: 'Termos de Utilização',
      subtitle: 'Regras simples para usar o Goldenbook Go.',
      body: [
        'Ao usar o Goldenbook Go, concordas em utilizar a aplicação e o website apenas para fins pessoais e não comerciais.',
        'Todo o conteúdo editorial — picks, rotas e descrições — é propriedade do Goldenbook Go. Podes partilhar links, mas a reprodução sem autorização não é permitida.',
        'Reservamo-nos o direito de atualizar estes termos. O uso continuado da aplicação constitui aceitação de quaisquer alterações.',
      ],
    },
    es: {
      type: 'editorial',
      title: 'Términos de Uso',
      subtitle: 'Reglas simples para usar Goldenbook Go.',
      body: [
        'Al usar Goldenbook Go, aceptas utilizar la app y el sitio web solo para fines personales y no comerciales.',
        'Todo el contenido editorial — picks, rutas y descripciones — es propiedad de Goldenbook Go. Puedes compartir enlaces, pero la reproducción sin permiso no está permitida.',
        'Nos reservamos el derecho de actualizar estos términos. El uso continuado de la app constituye la aceptación de cualquier cambio.',
      ],
    },
  },

  notifications: {
    en: {
      type: 'editorial',
      title: 'Notifications',
      subtitle: 'Stay in the loop, on your terms.',
      body: [
        'Get notified about new Golden Picks, route updates, and seasonal recommendations for your destination.',
        'Notification settings are coming in an upcoming update.',
      ],
    },
    pt: {
      type: 'editorial',
      title: 'Notificações',
      subtitle: 'Fica a par, nos teus próprios termos.',
      body: [
        'Recebe notificações sobre novos Golden Picks, atualizações de rotas e recomendações sazonais para o teu destino.',
        'As definições de notificações estão a chegar numa próxima atualização.',
      ],
    },
    es: {
      type: 'editorial',
      title: 'Notificaciones',
      subtitle: 'Mantente al día, a tu manera.',
      body: [
        'Recibe notificaciones sobre nuevos Golden Picks, actualizaciones de rutas y recomendaciones de temporada para tu destino.',
        'La configuración de notificaciones llegará en una próxima actualización.',
      ],
    },
  },

  contact: {
    en: {
      type: 'contact',
      title: 'Get in touch',
      subtitle: 'We read every message.',
      email: 'mail@goldenbook.pt',
      social: [
        {
          label: 'Instagram',
          url: 'https://www.instagram.com/goldenbook.pt/',
          icon: 'instagram',
        },
        {
          label: 'Facebook',
          url: 'https://www.facebook.com/goldenbookportugal/',
          icon: 'facebook',
        },
      ],
    },
    pt: {
      type: 'contact',
      title: 'Fala connosco',
      subtitle: 'Lemos todas as mensagens.',
      email: 'mail@goldenbook.pt',
      social: [
        {
          label: 'Instagram',
          url: 'https://www.instagram.com/goldenbook.pt/',
          icon: 'instagram',
        },
        {
          label: 'Facebook',
          url: 'https://www.facebook.com/goldenbookportugal/',
          icon: 'facebook',
        },
      ],
    },
    es: {
      type: 'contact',
      title: 'Ponte en contacto',
      subtitle: 'Leemos cada mensaje.',
      email: 'mail@goldenbook.pt',
      social: [
        {
          label: 'Instagram',
          url: 'https://www.instagram.com/goldenbook.pt/',
          icon: 'instagram',
        },
        {
          label: 'Facebook',
          url: 'https://www.facebook.com/goldenbookportugal/',
          icon: 'facebook',
        },
      ],
    },
  },
};
