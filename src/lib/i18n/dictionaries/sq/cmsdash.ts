import type { cmsdash as cmsdashEn } from '../en/cmsdash';

export const cmsdash: typeof cmsdashEn = {
  // Të përbashkëta
  'cmsdash.title': 'Paneli kryesor',
  'cmsdash.description': 'Një përmbledhje e dyqanit, përmbajtjes dhe porosive tuaja.',
  'cmsdash.viewShop': 'Shiko dyqanin',
  'cmsdash.viewAll': 'Shiko të gjitha',
  'cmsdash.guest': 'Mysafir',
  'cmsdash.deletedProduct': 'Produkt i fshirë',

  // Titujt e tabelës (paneli + raportet)
  'cmsdash.th.order': 'Porosia',
  'cmsdash.th.customer': 'Klienti',
  'cmsdash.th.date': 'Data',
  'cmsdash.th.total': 'Totali',
  'cmsdash.th.status': 'Statusi',
  'cmsdash.th.product': 'Produkti',
  'cmsdash.th.sku': 'SKU',
  'cmsdash.th.unitsSold': 'Njësitë e shitura',
  'cmsdash.th.revenue': 'Të ardhurat',
  'cmsdash.th.orders': 'Porositë',

  // Paneli kryesor — kartat e statistikave
  'cmsdash.stat.products': 'Produktet',
  'cmsdash.stat.productsHint': '{count} me stok të ulët',
  'cmsdash.stat.orders': 'Porositë',
  'cmsdash.stat.ordersHint': 'Të gjitha porositë online',
  'cmsdash.stat.customers': 'Klientët',
  'cmsdash.stat.customersHint': 'Llogaritë e regjistruara',
  'cmsdash.stat.revenue': 'Të ardhurat e këtij muaji',
  'cmsdash.stat.revenueHint': 'Porositë online',

  // Paneli kryesor — porositë e fundit
  'cmsdash.recentOrders': 'Porositë e fundit',
  'cmsdash.recentOrders.emptyTitle': 'Ende asnjë porosi online',
  'cmsdash.recentOrders.emptyDescription':
    'Porositë e bëra përmes dyqanit online do të shfaqen këtu.',

  // Paneli kryesor — veprimet e shpejta
  'cmsdash.quickActions': 'Veprimet e shpejta',
  'cmsdash.quick.newPage': 'Faqe e re',
  'cmsdash.quick.newPost': 'Publikim i ri',
  'cmsdash.quick.newProduct': 'Produkt i ri',
  'cmsdash.quick.customizer': 'Personalizuesi i temës',

  // Paneli kryesor — produktet + grafiku
  'cmsdash.topProducts': 'Produktet më të shitura',
  'cmsdash.topProducts.empty': 'Ende nuk ka të dhëna shitjesh.',
  'cmsdash.chart.title': 'Shitjet — 30 ditët e fundit',

  // Periudhat e raporteve
  'cmsdash.range.last7': '7 ditët e fundit',
  'cmsdash.range.last30': '30 ditët e fundit',
  'cmsdash.range.thisMonth': 'Ky muaj',

  // Raporti i shitjeve
  'cmsdash.sales.title': 'Raporti i shitjeve',
  'cmsdash.sales.description':
    'Të ardhurat, porositë dhe rritja e klientëve për periudhën e zgjedhur.',
  'cmsdash.sales.revenue': 'Totali i të ardhurave',
  'cmsdash.sales.revenueHint': 'Porositë online në periudhë',
  'cmsdash.sales.orders': 'Porositë',
  'cmsdash.sales.ordersHint': 'Të bëra përmes dyqanit online',
  'cmsdash.sales.average': 'Vlera mesatare e porosisë',
  'cmsdash.sales.averageHint': 'Të ardhurat ÷ porositë',
  'cmsdash.sales.newCustomers': 'Klientë të rinj',
  'cmsdash.sales.chartTitle': 'Të ardhurat për ditë — {period}',
  'cmsdash.sales.topProducts': '10 produktet më të mira sipas të ardhurave',
  'cmsdash.sales.emptyTitle': 'Pa të dhëna shitjesh në këtë periudhë',
  'cmsdash.sales.emptyDescription': 'Nuk u regjistruan shitje online për këtë periudhë.',

  // Raporti i stokut
  'cmsdash.stock.title': 'Raporti i stokut',
  'cmsdash.stock.description':
    'Produktet që kërkojnë vëmendje: me stok të ulët dhe krejtësisht jashtë stokut.',
  'cmsdash.stock.low': 'Stok i ulët',
  'cmsdash.stock.out': 'Jashtë stokut',
  'cmsdash.stock.currentStock': 'Stoku aktual',
  'cmsdash.stock.minLevel': 'Niveli minimal',
  'cmsdash.stock.action': 'Veprimi',
  'cmsdash.stock.restock': 'Plotëso stokun',
  'cmsdash.stock.emptyLowTitle': 'Asnjë produkt me stok të ulët',
  'cmsdash.stock.emptyLowDescription':
    'Çdo produkt aktiv është mbi nivelin minimal të stokut.',
  'cmsdash.stock.emptyOutTitle': 'Asgjë jashtë stokut',
  'cmsdash.stock.emptyOutDescription':
    'Të gjitha produktet aktualisht kanë stok të disponueshëm.',
  'cmsdash.stock.limitNote': 'Shfaqen {limit} produktet e para për çdo listë.',

  // Raporti i klientëve
  'cmsdash.customers.title': 'Raporti i klientëve',
  'cmsdash.customers.description':
    'Rritja e klientëve dhe blerësit që shpenzojnë më shumë.',
  'cmsdash.customers.total': 'Totali i klientëve',
  'cmsdash.customers.totalHint': 'Regjistrimet e klientëve',
  'cmsdash.customers.new': 'Të rinj këtë muaj',
  'cmsdash.customers.newHint': 'U regjistruan këtë muaj',
  'cmsdash.customers.returning': 'Klientët që janë kthyer',
  'cmsdash.customers.returningHint': 'Kanë bërë porosi para këtij muaji',
  'cmsdash.customers.topTitle': '10 klientët me shpenzimet më të larta',
  'cmsdash.customers.emptyTitle': 'Ende asnjë porosi nga klientët',
  'cmsdash.customers.emptyDescription':
    ' asnjë klient nuk ka përfunduar ende një porosi online.',
  'cmsdash.customers.joined': 'Regjistruar më',
  'cmsdash.customers.totalSpent': 'Shpenzuar gjithsej',
  'cmsdash.customers.noEmail': 'Pa email',

  // Raporti i produkteve
  'cmsdash.products.title': 'Raporti i produkteve',
  'cmsdash.products.description': 'Më të shiturat sipas sasisë së shitur — {period}.',
  'cmsdash.products.units': 'Njësitë e shitura',
  'cmsdash.products.top10Hint': 'Në 10 produktet kryesore',
  'cmsdash.products.revenue': 'Të ardhurat',
  'cmsdash.products.sold': 'Produktet e shitura',
  'cmsdash.products.soldHint': 'Me të paktën një shitje në periudhë',
  'cmsdash.products.topTitle': '10 produktet më të mira sipas sasisë së shitur',
  'cmsdash.products.tableTitle': 'Sasitë, të ardhurat dhe stoku i mbetur',
  'cmsdash.products.remainingStock': 'Stoku i mbetur',
  'cmsdash.products.emptyTitle': 'Ende asnjë shitje produktesh',
  'cmsdash.products.emptyDescription': 'Nuk u regjistruan shitje online në 30 ditët e fundit.',
};
