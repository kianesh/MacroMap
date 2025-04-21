/**
 * Simple in-memory queue to manage OpenAI API calls
 */
export class OpenAIRateLimiter {
    private queue: Array<() => Promise<any>> = [];
    private isProcessing = false;
    private requestsThisMinute = 0;
    private lastResetTime = Date.now();
    private readonly MAX_REQUESTS_PER_MINUTE = 5; // Set lower than the actual limit (10000 TPM)
  
    /**
     * Add a function to the rate-limited queue
     * @param fn The function to execute (should return a Promise)
     * @returns A promise that resolves with the result of the function
     */
    async schedule<T>(fn: () => Promise<T>): Promise<T> {
      return new Promise((resolve, reject) => {
        this.queue.push(async () => {
          try {
            const result = await fn();
            resolve(result);
            return result;
          } catch (error) {
            reject(error);
            throw error;
          }
        });
        
        if (!this.isProcessing) {
          this.processQueue();
        }
      });
    }
  
    /**
     * Process the queue with rate limiting
     */
    private async processQueue() {
      if (this.queue.length === 0) {
        this.isProcessing = false;
        return;
      }
  
      this.isProcessing = true;
  
      // Reset counter if a minute has passed
      const now = Date.now();
      if (now - this.lastResetTime > 60000) {
        this.requestsThisMinute = 0;
        this.lastResetTime = now;
      }
  
      // Check if we're at the rate limit
      if (this.requestsThisMinute >= this.MAX_REQUESTS_PER_MINUTE) {
        const timeToWait = 60000 - (now - this.lastResetTime) + 100; // Add 100ms buffer
        await new Promise(resolve => setTimeout(resolve, timeToWait));
        this.requestsThisMinute = 0;
        this.lastResetTime = Date.now();
      }
  
      // Process next item in queue
      const nextFn = this.queue.shift();
      if (nextFn) {
        this.requestsThisMinute++;
        try {
          await nextFn();
        } catch (error) {
          console.error("Rate limited function error:", error);
        }
        
        // Add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Continue processing
        this.processQueue();
      } else {
        this.isProcessing = false;
      }
    }
  }
  
  // Export a singleton instance
  export const openAILimiter = new OpenAIRateLimiter();