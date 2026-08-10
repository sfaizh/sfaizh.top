import type { CatppuccinFlavour, PostMeta, SiteStats } from '@sfaizh/shared';
import type { MotionPreference } from '../hooks';
import type { Line } from './output';
import type { Filesystem } from './vfs';

/** Side effects a command can ask the shell to perform. */
export type Effect =
  | { type: 'clear' }
  | { type: 'open'; slug: string }
  | { type: 'flavour'; flavour: CatppuccinFlavour }
  | { type: 'motion'; preference: MotionPreference }
  | { type: 'navigate'; href: string }
  | { type: 'cd'; path: string }
  | { type: 'reboot' }
  | { type: 'focus-input' };

export interface ShellState {
  cwd: string;
  posts: PostMeta[];
  fs: Filesystem;
  history: string[];
  flavour: CatppuccinFlavour;
  stats: SiteStats | null;
  /** Exit code of the previous command — the prompt turns red when non-zero. */
  lastExit: number;
  /** Whether animations are currently suppressed. */
  reducedMotion: boolean;
  /** How that was decided: following the device, or set by hand. */
  motion: MotionPreference;
}

export interface CommandContext {
  /** The command name as typed, including any alias. */
  name: string;
  args: string[];
  raw: string;
  state: ShellState;
}

export interface CommandResult {
  lines: Line[];
  exitCode: number;
  effects?: Effect[];
}

export type CommandGroup = 'navigation' | 'content' | 'appearance' | 'system';

export interface Command {
  name: string;
  aliases?: readonly string[];
  summary: string;
  usage?: string;
  group: CommandGroup;
  /** Hidden commands work but are omitted from `help`. */
  hidden?: boolean;
  /** Candidate completions for the argument currently being typed. */
  completions?(state: ShellState, args: string[]): string[];
  run(context: CommandContext): CommandResult | Promise<CommandResult>;
}

export const success = (lines: Line[] = [], effects?: Effect[]): CommandResult => ({
  lines,
  exitCode: 0,
  effects,
});

export const failure = (lines: Line[], exitCode = 1): CommandResult => ({ lines, exitCode });
