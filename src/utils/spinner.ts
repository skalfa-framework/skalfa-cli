import readline from "node:readline";

export class Spinner {
  private timer: NodeJS.Timeout | null = null;
  private message: string;
  private frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private currentFrame = 0;

  constructor(message: string) {
    this.message = message;
  }

  start() {
    // Hide cursor
    process.stdout.write("\x1B[?25l");
    this.timer = setInterval(() => {
      const frame = this.frames[this.currentFrame];
      process.stdout.write(`\r\x1B[35m${frame}\x1B[0m ${this.message}`);
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }, 80);
  }

  update(message: string) {
    this.message = message;
  }

  stop(success = true, statusMessage?: string) {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Clear line
    process.stdout.write("\r\x1B[K");
    // Show cursor
    process.stdout.write("\x1B[?25h");

    if (success) {
      console.log(`\x1B[32m✓\x1B[0m ${statusMessage || this.message}`);
    } else {
      console.log(`\x1B[31m✗\x1B[0m ${statusMessage || this.message}`);
    }
  }
}
