import { lazy, Suspense, type LazyExoticComponent } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { App } from '@/App';
import { Container } from '@/components/layout/container';
import { Skeleton } from '@/components/ui/skeleton';

const FeedPage = lazy(() => import('@/pages/feed-page').then((module) => ({ default: module.FeedPage })));
const DigestsPage = lazy(() => import('@/pages/digests-page').then((module) => ({ default: module.DigestsPage })));
const RandomPage = lazy(() => import('@/pages/random-page').then((module) => ({ default: module.RandomPage })));
const ForYouPage = lazy(() => import('@/pages/for-you-page').then((module) => ({ default: module.ForYouPage })));
const PostPage = lazy(() => import('@/pages/post-page').then((module) => ({ default: module.PostPage })));
const MyPostsPage = lazy(() => import('@/pages/my-posts-page').then((module) => ({ default: module.MyPostsPage })));
const ProfilePage = lazy(() => import('@/pages/profile-page').then((module) => ({ default: module.ProfilePage })));
const SavedArticlesPage = lazy(() => import('@/pages/saved-articles-page').then((module) => ({ default: module.SavedArticlesPage })));
const TopicPreferencesPage = lazy(() => import('@/pages/topic-preferences-page').then((module) => ({ default: module.TopicPreferencesPage })));
const AdminNewPage = lazy(() => import('@/pages/admin-new-page').then((module) => ({ default: module.AdminNewPage })));
const AdminEditPage = lazy(() => import('@/pages/admin-edit-page').then((module) => ({ default: module.AdminEditPage })));
const TopicPreferencesOnboardingPage = lazy(() =>
  import('@/pages/onboarding/TopicPreferencesOnboarding').then((module) => ({ default: module.TopicPreferencesOnboardingPage })),
);

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
      { path: 'for-you', element: withSuspense(ForYouPage) },
      { path: 'digests', element: withSuspense(DigestsPage) },
      { path: 'random', element: withSuspense(RandomPage) },
      { path: 'post/:id', element: withSuspense(PostPage) },
      { path: 'my-posts', element: withSuspense(MyPostsPage) },
      { path: 'profile', element: withSuspense(ProfilePage) },
      { path: 'saved-articles', element: withSuspense(SavedArticlesPage) },
      { path: 'topic-preferences', element: withSuspense(TopicPreferencesPage) },
      { path: 'admin/new', element: withSuspense(AdminNewPage) },
      { path: 'admin/edit/:id', element: withSuspense(AdminEditPage) },
    ],
  },
  { path: '/onboarding/topics', element: withSuspense(TopicPreferencesOnboardingPage) },
]);
