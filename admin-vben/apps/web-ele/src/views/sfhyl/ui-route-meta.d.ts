import 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    homepageView?: 'about' | 'brands' | 'cta' | 'modules' | 'recommendations' | 'video';
    catalogKind?: 'brands' | 'categories' | 'models' | 'series' | 'tags';
  }
}
