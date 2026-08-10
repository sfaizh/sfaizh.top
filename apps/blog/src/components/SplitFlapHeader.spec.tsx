import { act, render } from '@testing-library/react';
import { SplitFlapHeader } from './SplitFlapHeader';

/**
 * Regression cover for a bug where the board advanced exactly one step and
 * stopped: the "have all columns landed?" flag was computed inside a
 * `setState` updater, which React runs later, so the frame loop always read a
 * stale value and never scheduled the next frame. The visible symptom was a
 * board that changed one character every few seconds with no animation.
 */

/**
 * Blank flaps render a non-breaking space so an empty unit keeps its width;
 * normalise those back to ordinary spaces before comparing.
 */
function boardText(container: HTMLElement): string {
  return [...container.querySelectorAll('.flap')]
    .map((flap) => flap.textContent)
    .join('')
    .replace(/\u00a0/g, ' ');
}

describe('SplitFlapHeader', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('keeps stepping instead of stopping after one frame', () => {
    const { container } = render(<SplitFlapHeader />);
    expect(boardText(container).trim()).toBe('');

    // Sample the board repeatedly. A loop that schedules only one frame can
    // produce at most two distinct states; a running one produces many.
    const seen = new Set<string>();
    for (let sample = 0; sample < 14; sample++) {
      act(() => {
        jest.advanceTimersByTime(46 * 4);
      });
      seen.add(boardText(container));
    }

    expect(seen.size).toBeGreaterThan(4);
  });

  it('lands on the first phrase', () => {
    const { container } = render(<SplitFlapHeader />);

    act(() => {
      jest.advanceTimersByTime(4800);
    });

    expect(boardText(container).trim()).toBe('SFAIZH.TOP');
  });

  it('flips to the second phrase once the first has been held', () => {
    const { container } = render(<SplitFlapHeader />);

    act(() => {
      jest.advanceTimersByTime(4800);
    });
    expect(boardText(container).trim()).toBe('SFAIZH.TOP');

    // Cross the 5200ms phrase timer in its own `act`, so React has flushed the
    // new phrase — and started its animation — before time advances again.
    act(() => {
      jest.advanceTimersByTime(600);
    });
    act(() => {
      jest.advanceTimersByTime(3500);
    });

    expect(boardText(container).trim()).toBe('ENGINEERING BLOG');
  });

  it('renders one flap per column of the longest phrase', () => {
    const { container } = render(<SplitFlapHeader />);
    expect(container.querySelectorAll('.flap')).toHaveLength('ENGINEERING BLOG'.length);
  });

  it('exposes a stable accessible name that does not flicker', () => {
    const { container, getByText } = render(<SplitFlapHeader />);

    expect(getByText('sfaizh.top — engineering blog')).toBeTruthy();
    // The animated flaps themselves are decorative.
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  it('stops cleanly on unmount', () => {
    const { unmount } = render(<SplitFlapHeader />);
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(() => {
      unmount();
      jest.advanceTimersByTime(5000);
    }).not.toThrow();
  });
});
