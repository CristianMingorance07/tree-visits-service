import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from '../views/Dashboard.vue';
import TrackView from '../views/TrackView.vue';

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Dashboard },
    { path: '/track', component: TrackView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});
