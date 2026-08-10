import { Shell } from '../components/Shell';

/**
 * The whole public site is one route. Posts are opened by the pager rather
 * than by navigation, so there is no page transition to design and no state to
 * lose when you close a post.
 */
export default function Index() {
  return <Shell />;
}
