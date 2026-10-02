import type { tools as toolsEn } from '../en/tools';

export const tools: typeof toolsEn = {
  // I përbashkët për wishlist + compare
  'tools.try_again': 'Provo përsëri',
  'tools.browse': 'Shfleto produktet',
  'tools.add_another': 'Shto një tjetër',
  'tools.select_options': 'Zgjidh variantet',
  'tools.view_product': 'Shiko produktin',
  'tools.variant': 'Varianti {id}',
  'tools.busy_syncing': 'Duke sinkronizuar…',
  'tools.busy_saving': 'Duke ruajtur…',
  'tools.cart_added': '{name} u shtua në shportën tuaj.',
  'tools.cart_limit': '{name} arriti kufirin e sasisë në shportë.',
  'tools.cart_failed': 'Ky artikull nuk mund të shtohej. Kontrolloni mesazhin e shportës.',
  'tools.storage_memory': 'I disponueshëm vetëm për këtë skedë',
  'tools.storage_unavailable': 'Ruajtja e shfletuesit është e padisponueshme',
  'tools.th_product': 'Produkti',
  'tools.th_price': 'Çmimi',

  // Wishlist
  'tools.wishlist.loading_title': 'Duke ngarkuar listën tuaj…',
  'tools.wishlist.loading_text': 'Duke kontrolluar gjendjen lokale dhe të llogarisë.',
  'tools.wishlist.title': 'Lista juaj e dëshirave',
  'tools.wishlist.crumb': 'Lista e dëshirave',
  'tools.wishlist.eyebrow': 'Ruajtur për më vonë',
  'tools.wishlist.lead_signed_in':
    'Mbajeni listën e dëshirave të llogarisë të sinkronizuar kur jeni të kyçur.',
  'tools.wishlist.lead_guest':
    'Mbani një listë private produktesh për t’i parë sërish në këtë pajisje.',
  'tools.wishlist.count_aria': '{count} artikuj të ruajtur',
  'tools.wishlist.count_display': '{count} të ruajtura',
  'tools.wishlist.contents_aria': 'Përmbajtja e listës së dëshirave',
  'tools.wishlist.storage_local': 'Ruajtur në këtë shfletues',
  'tools.wishlist.storage_fallback': 'Listë lokale',
  'tools.wishlist.status_syncing': 'Duke kontrolluar listën e llogarisë suaj…',
  'tools.wishlist.status_synced': 'Sinkronizuar me llogarinë tuaj',
  'tools.wishlist.status_draft_error': 'Kopje lokale — sinkronizimi kujdes',
  'tools.wishlist.status_draft': 'Kopje lokale — në pritje të sinkronizimit',
  'tools.wishlist.status_local_only': 'Listë vetëm lokale',
  'tools.wishlist.suffix_authoritative': ' · rreshtat e produkteve nga serveri janë autoritativë',
  'tools.wishlist.suffix_pending': ' · ndryshimet lokale presin sinkronizimin',
  'tools.wishlist.suffix_guests': ' · vizitorët e mbajnë këtë listë në këtë shfletues',
  'tools.wishlist.error_title': 'Nuk mund ta kryenim këtë ndryshim të listës',
  'tools.wishlist.empty_title': 'Lista juaj e dëshirave është bosh',
  'tools.wishlist.empty_text':
    'Përdorni zemrën te një produkt për ta ruajtur këtu për më vonë.',
  'tools.wishlist.caption': 'Produktet e ruajtura në këtë listë',
  'tools.wishlist.th_added': 'Shtuar më',
  'tools.wishlist.th_availability': 'Disponueshmëria',
  'tools.wishlist.th_actions': 'Veprimet',
  'tools.wishlist.date_unavailable': 'Data e padisponueshme',
  'tools.wishlist.remove': 'Hiq',
  'tools.wishlist.remove_aria': 'Hiq {name} nga lista e dëshirave',
  'tools.wishlist.note_signed_in_title': 'Kjo listë është sinkronizuar me llogarinë tuaj.',
  'tools.wishlist.note_signed_in_text':
    'Dalja nga llogaria e kthen këtë pamje te kopja lokale e shfletuesit; rreshtat e llogarisë nuk ndahen përmes URL-së.',
  'tools.wishlist.note_guest_title': 'Kjo listë është private për këtë shfletues.',
  'tools.wishlist.note_guest_text':
    'Kopjimi i URL-së së faqes aktuale nuk ndan këta artikuj. Një token real ndarjeje dhe sinkronizimi me llogarinë nuk janë lidhur ende.',
  'tools.wishlist.storage_read_error':
    'Lista e ruajtur nuk mund të lexohej në këtë shfletues. Mund ta provoni sërish me siguri, por ndryshimet do të mbeten në kujtesë për tani.',
  'tools.wishlist.storage_write_error':
    'Lista juaj u ndryshua, por ky shfletues nuk mund ta ruante lokalisht. Do të mbetet i disponueshëm vetëm për këtë skedë.',
  'tools.wishlist.error_invalid': 'Ky artikull i listës nuk është i vlefshëm.',
  'tools.wishlist.error_ambiguous':
    'Zgjidhni një variant specifik të produktit përpara se ta ndryshoni.',

  // Krahasimi
  'tools.compare.loading_title': 'Duke ngarkuar krahasimin…',
  'tools.compare.loading_text': 'Duke kontrolluar këtë shfletues dhe llogarinë tuaj.',
  'tools.compare.title': 'Krahaso produktet',
  'tools.compare.crumb': 'Krahasimi',
  'tools.compare.eyebrow': 'Bëni një zgjedhje të menduar',
  'tools.compare.lead': 'Krahasoni deri në {max} produkte krahas njëri-tjetrit.',
  'tools.compare.count_aria': '{count} produkte në krahasim',
  'tools.compare.contents_aria': 'Krahasimi i produkteve',
  'tools.compare.storage_session': 'Ruajtur vetëm për këtë seancë shfletuesi',
  'tools.compare.storage_legacy':
    'U ngarkua nga një ruajtje e mëparshme lokale; ndryshimet kufizohen te seanca kur është e mundur',
  'tools.compare.storage_fallback': 'Krahasim seance',
  'tools.compare.status_error': 'Krahasimi kujdes',
  'tools.compare.status_synced': 'Ruajtur në llogarinë tuaj · i sinkronizuar në pajisjet tuaja',
  'tools.compare.status_syncing': 'Duke përditësuar krahasimin e llogarisë suaj…',
  'tools.compare.suffix_sync_paused': ' · sinkronizimi me llogarinë u ndalua',
  'tools.compare.suffix_signin': ' · kyçuni për sinkronizim në pajisje',
  'tools.compare.error_title': 'Përditësimit të krahasimit i duhet vëmendje',
  'tools.compare.sync_paused_title': 'Sinkronizimi me llogarinë u ndalua',
  'tools.compare.empty_title': 'Asgjë për të krahasuar ende',
  'tools.compare.empty_text':
    'Shtoni produkte me veprimin e krahasimit te një kartë produkti. Mund të krahasoni deri në {max} njëkohësisht.',
  'tools.compare.selected': '{count} nga {max} produkte të zgjedhura',
  'tools.compare.slots_hint':
    'Hapësirat e para {max} mbeten tuajat derisa të hiqni një artikull.',
  'tools.compare.limit_reached': 'Arriti kufiri',
  'tools.compare.clear_all': 'Pastro të gjitha',
  'tools.compare.limit_over_title': 'Krahasimi i ruajtur tejkalon kufirin',
  'tools.compare.limit_title': 'U arrit kufiri i krahasimit',
  'tools.compare.caption': 'Detajet e produkteve për këtë seancë shfletuesi',
  'tools.compare.th_sku': 'SKU',
  'tools.compare.th_stock': 'Stoku',
  'tools.compare.th_description': 'Përshkrimi',
  'tools.compare.no_description': 'Asnjë përshkrim i dhënë.',
  'tools.compare.limit_message':
    'Krahasimi kufizohet në {max} produkte. Hiqni një para se të shtoni një tjetër.',
  'tools.compare.error_invalid': 'Ky artikull krahasimi nuk është i vlefshëm.',
  'tools.compare.error_ambiguous':
    'Zgjidhni një variant specifik të produktit përpara se ta ndryshoni.',
  'tools.compare.storage_write_error':
    'Krahasimi u ndryshua, por kjo seancë shfletuesi nuk mund ta ruante. Do të mbetet i disponueshëm vetëm për këtë skedë.',
  'tools.compare.storage_read_error':
    'Krahasimi i ruajtur nuk mund të lexohej në këtë shfletues. Mund ta provoni sërish me siguri, por ndryshimet do të mbeten në kujtesë për këtë skedë.',
  'tools.compare.sync_save_error':
    'Krahasimi nuk mund të ruhej në llogarinë tuaj tani. Është ende i disponueshëm në këtë shfletues.',
  'tools.compare.sync_load_error':
    'Krahasimi i llogarisë suaj nuk mund të ngarkohej. Kopja e shfletuesit shfaqet ende.',
  'tools.compare.remove_aria': 'Hiq {name} nga krahasimi',
};
