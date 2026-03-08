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
const ReadingHistoryPage = lazy(() => import('@/pages/reading-history-page').then((module) => ({ default: module.ReadingHistoryPage })));
const ActivityPage = lazy(() => import('@/pages/activity-page').then((module) => ({ default: module.ActivityPage })));
const SupportPage = lazy(() => import('@/pages/support-page').then((module) => ({ default: module.SupportPage })));
const AboutPage = lazy(() => import('@/pages/about-page').then((module) => ({ default: module.AboutPage })));
const AuthorPanelPage = lazy(() => import('@/pages/author-panel-page').then((module) => ({ default: module.AuthorPanelPage })));
const WebAppDebugPage = lazy(() => import('@/pages/webapp-debug-page').then((module) => ({ default: module.WebAppDebugPage })));
const TopicPreferencesPage = lazy(() => import('@/pages/topic-preferences-page').then((module) => ({ default: module.TopicPreferencesPage })));
const AdminNewPage = lazy(() => import('@/pages/admin-new-page').then((module) => ({ default: module.AdminNewPage })));
const AdminImportPage = lazy(() => import('@/pages/admin-import-page').then((module) => ({ default: module.AdminImportPage })));
const AdminEditPage = lazy(() => import('@/pages/admin-edit-page').then((module) => ({ default: module.AdminEditPage })));
const AdminUsersPage = lazy(() => import('@/pages/admin-users-page').then((module) => ({ default: module.AdminUsersPage })));
const AdminPublicationRulesPage = lazy(() =>
  import('@/pages/admin-publication-rules-page').then((module) => ({ default: module.AdminPublicationRulesPage })),
);
const TopicPreferencesOnboardingPage = lazy(() =>
  import('@/pages/onboarding/TopicPreferencesOnboarding').then((module) => ({ default: module.TopicPreferencesOnboardingPage })),
);
const WelcomeOnboardingPage = lazy(() =>
  import('@/pages/onboarding/welcome-onboarding-page').then((module) => ({ default: module.WelcomeOnboardingPage })),
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
      { path: 'reading-history', element: withSuspense(ReadingHistoryPage) },
      { path: 'activity', element: withSuspense(ActivityPage) },
      { path: 'support', element: withSuspense(SupportPage) },
      { path: 'about', element: withSuspense(AboutPage) },
      { path: 'author', element: withSuspense(AuthorPanelPage) },
      { path: 'webapp-debug', element: withSuspense(WebAppDebugPage) },
      { path: 'topic-preferences', element: withSuspense(TopicPreferencesPage) },
      { path: 'admin/new', element: withSuspense(AdminNewPage) },
      { path: 'admin/import', element: withSuspense(AdminImportPage) },
      { path: 'admin/edit/:id', element: withSuspense(AdminEditPage) },
      { path: 'admin/users', element: withSuspense(AdminUsersPage) },
      { path: 'admin/publication-rules', element: withSuspense(AdminPublicationRulesPage) },
    ],
  },
  { path: '/onboarding/welcome', element: withSuspense(WelcomeOnboardingPage) },
  { path: '/onboarding/topics', element: withSuspense(TopicPreferencesOnboardingPage) },
]);
