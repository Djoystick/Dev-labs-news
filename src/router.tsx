import { lazy, Suspense, type LazyExoticComponent } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { App } from '@/App';
import { Container } from '@/components/layout/container';
import { Skeleton } from '@/components/ui/skeleton';

const FeedPage = lazy(() => import('@/pages/feed-page').then((module) => ({ default: module.FeedPage })));
const DigestsPage = lazy(() => import('@/pages/digests-page').then((module) => ({ default: module.DigestsPage })));
const RandomPage = lazy(() => import('@/pages/random-page').then((module) => ({ default: module.RandomPage })));
const PostPage = lazy(() => import('@/pages/post-page').then((module) => ({ default: module.PostPage })));
const ProfilePage = lazy(() => import('@/pages/profile-page').then((module) => ({ default: module.ProfilePage })));
const AdminNewPage = lazy(() => import('@/pages/admin-new-page').then((module) => ({ default: module.AdminNewPage })));
const AdminEditPage = lazy(() => import('@/pages/admin-edit-page').then((module) => ({ default: module.AdminEditPage })));

function RouteFallback() {
  return (
    <Container className="safe-pb py-8">
      <div className="space-y-5">
        <Skeleton className="h-36 w-full rounded-[2rem]" />
        <Skeleton className="h-64 w-full rounded-[2rem]" />
      </div>
    </Container>
  );
}

function withSuspense(Component: LazyExoticComponent<() => JSX.Element>) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Component />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: withSuspense(FeedPage) },
      { path: 'digests', element: withSuspense(DigestsPage) },
      { path: 'random', element: withSuspense(RandomPage) },
      { path: 'post/:id', element: withSuspense(PostPage) },
      { path: 'profile', element: withSuspense(ProfilePage) },
      { path: 'admin/new', element: withSuspense(AdminNewPage) },
      { path: 'admin/edit/:id', element: withSuspense(AdminEditPage) },
    ],
  },
]);
