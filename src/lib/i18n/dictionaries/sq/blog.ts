import type { blog as blogEn } from '../en/blog';

export const blog: typeof blogEn = {
  'blog.title': 'Blogu',
  'blog.crumb.home': 'Kryefaqja',
  'blog.card.read': 'Lexo {title}',
  'blog.card.by': 'Nga {name}',
  'blog.reply.loggedInAs': 'Je kyçur si {name}.',
  'blog.reply.editProfile': 'Ndrysho profilin.',
  'blog.reply.required': 'Fushat e detyrueshme janë shënuar me',
  'blog.reply.name': 'Emri',
  'blog.reply.comment': 'Komenti',
  'blog.reply.post': 'Dërgo komentin',
  'blog.reply.posting': 'Duke dërguar…',
  'blog.reply.count': '{count} komente',

  // Listing results
  'blog.results.filteredKicker': 'Rezultatet e filtruara',
  'blog.results.defaultKicker': 'Nga blogu',
  'blog.results.filteredTitle': 'Rezultatet e kërkimit',
  'blog.results.defaultTitle': 'Postimet e fundit',
  'blog.results.showing': 'Duke shfaqur {start}–{end} nga {total} {label}',
  'blog.results.none': 'Asnjë {label} nuk u gjet',
  'blog.results.labelOne': 'postim',
  'blog.results.labelOther': 'postime',

  // Listing empty states
  'blog.empty.filteredTitle': 'Asnjë postim nuk përputhet me kërkimin tuaj',
  'blog.empty.filteredText':
    'Provoni një fjalë kyçe tjetër ose pastroni filtrat aktivë të kategorisë dhe temës.',
  'blog.empty.title': 'Ende pa postime blogu',
  'blog.empty.text': 'Historitë e reja do të shfaqen këtu sapo të publikohen.',
  'blog.empty.clear': 'Pastro filtrat',

  // Sidebar
  'blog.sidebar.aria': 'Anësorja e blogut',
  'blog.sidebar.searchHeading': 'Kërko',
  'blog.sidebar.searchLabel': 'Kërko në postimet e blogut',
  'blog.sidebar.searchPlaceholder': 'Kërko në blog',
  'blog.sidebar.searchButton': 'Kërko',
  'blog.sidebar.clear': 'Pastro filtrat',
  'blog.categories.heading': 'Kategoritë',
  'blog.categories.all': 'Të gjitha kategoritë',
  'blog.categories.empty': 'Ende pa kategori.',
  'blog.recent.heading': 'Postimet e fundit',
  'blog.recent.empty': 'Ende pa postime të fundit.',
  'blog.tags.heading': 'Etiketat popullore',
  'blog.tags.empty': 'Ende pa tema.',

  // Pagination
  'blog.pagination.aria': 'Numërimi i faqeve të blogut',
  'blog.pagination.previous': 'Faqja e mëparshme',
  'blog.pagination.next': 'Faqja tjetër',
  'blog.pagination.page': 'Faqja {page}',

  // Article detail
  'blog.article.empty': 'Ky artikull nuk ka ende përmbajtje të lexueshme.',
  'blog.article.metaAria': 'Informacionet e artikullit',
  'blog.article.minRead': '{count} min lexim',
  'blog.article.tags': 'Etiketat',
  'blog.article.navAria': 'Navigimi i postimeve',
  'blog.article.previous': 'Postimi i mëparshëm',
  'blog.article.next': 'Postimi tjetër',
  'blog.article.replyTitle': 'Lini një përgjigje',
  'blog.article.commentsUnavailable': 'E padisponueshme',
  'blog.article.commentsNotice':
    'Kommentet nuk janë ende të disponueshme. Kërkohet një lidhje komentesh me moderim përpara se përgjigjet të dërgohen ose publikohen.',
  'blog.article.back': 'Kthehu te të gjitha postimet',

  // Article not found
  'blog.notFound.title': 'Ky postim nuk u gjet.',
  'blog.notFound.body':
    'Adresa mund të jetë e paplotë, ose postimi mund të ketë lëvizur. Kthehuni te blogu për të parë historitë e fundit.',
  'blog.notFound.return': 'Kthehu te blogu',
};
