export type BlogPublicationStatus = 'Draft' | 'Published';

export type BlogAdminPostSummary = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  coverImageUrl: string | null;
  authorName: string;
  status: BlogPublicationStatus;
  categoryId: number | null;
  categoryName: string;
  tags: string[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  readingMinutes: number;
};

export type BlogAdminPost = BlogAdminPostSummary & {
  content: string;
};

export type BlogAdminCategory = {
  id: number;
  name: string;
  status: 'Active' | 'Inactive' | 'Archived' | 'Pending' | 'Suspended';
};

export type BlogAdminTag = {
  id: number;
  name: string;
};

export type BlogEditorPageData = {
  categories: BlogAdminCategory[];
  tags: BlogAdminTag[];
  defaultAuthor: string;
  post: BlogAdminPost | null;
};

export type BlogPostActionState = {
  status: 'idle' | 'error' | 'success';
  message: string;
  fieldErrors: Partial<Record<'title' | 'slug' | 'author' | 'categoryId' | 'tags' | 'excerpt' | 'coverImageUrl' | 'content' | 'status' | 'publishedAt' | 'confirmation', string>>;
};

export const INITIAL_BLOG_POST_ACTION_STATE: BlogPostActionState = {
  status: 'idle',
  message: '',
  fieldErrors: {},
};
