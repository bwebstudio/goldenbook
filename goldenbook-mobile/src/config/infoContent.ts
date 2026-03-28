/**
 * infoContent.ts
 *
 * Static multilingual content for the profile Information screens.
 * Each page key maps to a LocalizedInfoPageContent object with per-locale
 * variants. Consumers pick content[locale] ?? content.en.
 *
 * To add a new page: add an entry to INFO_CONTENT and navigate with:
 *   router.push({ pathname: '/info', params: { contentKey: 'about' } })
 */

// ─── Types ────────────────────────────────────────────────────────────────────

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

/** Per-locale variants for a single info page. Always has English. */
export type LocalizedInfoPageContent = {
  en: InfoPageContent;
  'pt-PT': InfoPageContent;
};

// ─── Content ─────────────────────────────────────────────────────────────────

export const INFO_CONTENT: Record<string, LocalizedInfoPageContent> = {
  about: {
    en: {
      type: 'editorial',
      title: 'About Goldenbook',
      subtitle: 'The curated city guide for the discerning traveller.',
      body: [
        'Goldenbook is a curated guide to the places that actually matter — the restaurants worth the detour, the viewpoints only locals know, the neighbourhood bars with no sign on the door.',
        'We believe the best travel experiences come from genuine knowledge, not algorithms. Every place in Goldenbook is selected by editors with deep roots in their cities.',
        'We started in Lisbon. We are expanding to Porto, the Algarve, and beyond.',
      ],
    },
    'pt-PT': {
      type: 'editorial',
      title: 'Sobre o Goldenbook',
      subtitle: 'O guia curado da cidade para o viajante exigente.',
      body: [
        'O Goldenbook é um guia curado dos lugares que realmente importam — os restaurantes que valem a deslocação, os miradouros que só os locais conhecem, os bares de bairro sem placa na porta.',
        'Acreditamos que as melhores experiências de viagem vêm de um conhecimento genuíno, não de algoritmos. Cada lugar no Goldenbook é selecionado por editores com raízes profundas nas suas cidades.',
        'Começámos em Lisboa. Estamos a expandir para o Porto, o Algarve e além.',
      ],
    },
  },

  privacy: {
    en: {
      type: 'editorial',
      title: 'Privacy Policy',
      subtitle: 'We keep your data simple and your experience clean.',
      body: [
        'Goldenbook collects only the data necessary to personalise your experience: your saved places, preferred city, and language setting. We do not sell your data.',
        'We use Supabase for secure authentication and data storage. Analytics are anonymised and never linked to your identity.',
        'To request deletion of your account and data, contact us at privacy@goldenbook.app.',
      ],
    },
    'pt-PT': {
      type: 'editorial',
      title: 'Política de Privacidade',
      subtitle: 'Mantemos os teus dados simples e a tua experiência limpa.',
      body: [
        'O Goldenbook recolhe apenas os dados necessários para personalizar a tua experiência: os teus lugares guardados, cidade preferida e preferência de idioma. Não vendemos os teus dados.',
        'Utilizamos o Supabase para autenticação segura e armazenamento de dados. As análises são anonimizadas e nunca associadas à tua identidade.',
        'Para solicitar a eliminação da tua conta e dados, contacta-nos em privacy@goldenbook.app.',
      ],
    },
  },

  terms: {
    en: {
      type: 'editorial',
      title: 'Terms of Use',
      subtitle: 'Simple rules for using Goldenbook.',
      body: [
        'By using Goldenbook, you agree to use the app and website for personal, non-commercial purposes only.',
        'All editorial content — picks, routes, and descriptions — is the property of Goldenbook. You may share links, but reproduction without permission is not permitted.',
        'We reserve the right to update these terms. Continued use of the app constitutes acceptance of any changes.',
      ],
    },
    'pt-PT': {
      type: 'editorial',
      title: 'Termos de Utilização',
      subtitle: 'Regras simples para usar o Goldenbook.',
      body: [
        'Ao usar o Goldenbook, concordas em utilizar a aplicação e o website apenas para fins pessoais e não comerciais.',
        'Todo o conteúdo editorial — picks, rotas e descrições — é propriedade do Goldenbook. Podes partilhar links, mas a reprodução sem autorização não é permitida.',
        'Reservamo-nos o direito de atualizar estes termos. O uso continuado da aplicação constitui aceitação de quaisquer alterações.',
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
    'pt-PT': {
      type: 'editorial',
      title: 'Notificações',
      subtitle: 'Fica a par, nos teus próprios termos.',
      body: [
        'Recebe notificações sobre novos Golden Picks, atualizações de rotas e recomendações sazonais para o teu destino.',
        'As definições de notificações estão a chegar numa próxima atualização.',
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
    'pt-PT': {
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
  },
};
