import { createBrowserRouter } from 'react-router-dom';
import { App } from '@/App';
import { AdminEditPage } from '@/pages/admin-edit-page';
import { AdminNewPage } from '@/pages/admin-new-page';
import { FeedPage } from '@/pages/feed-page';
import { PostPage } from '@/pages/post-page';
import { ProfilePage } from '@/pages/profile-page';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <FeedPage /> },
      { path: 'post/:id', element: <PostPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'admin/new', element: <AdminNewPage /> },
      { path: 'admin/edit/:id', element: <AdminEditPage /> },
    ],
  },
]);
