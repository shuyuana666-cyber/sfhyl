const Layout = () => import("@/layout/index.vue");

export default {
  path: "/",
  name: "Home",
  component: Layout,
  redirect: "/dashboard",
  meta: {
    title: "SFHYL.CN",
    showLink: false,
    rank: 0
  },
  children: []
} satisfies RouteConfigsTable;
