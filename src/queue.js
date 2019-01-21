const { Emitter } = require('event-kit');

class Queue {
  constructor({ automatic = true, concurrency = 1, timeout } = {}) {
    this.emitter = new Emitter();
    this.paused = false;
    this.destroyed = false;
    this.automatic = automatic;
    this.concurrency = concurrency;
    this.timeout = timeout;
    this.runningCount = 0;
    this.tasks = [];
  }

  _add(task) {
    if(typeof task !== 'function') throw new Error(`Task must be a function`);
    this.tasks.push(task);
    this.emitter.emit('did-add', task);
  }

  add(...tasks) {
    tasks.forEach( task=> this._add(task));
    if(!this.automatic) return;

    //Run on the next tick to allow consumers to set observers after adding tasks
    process.nextTick(this.next.bind(this));
  }

  remove(task) {
    if(!this.tasks.includes(task)) return;
    this.tasks.splice(this.tasks.indexOf(task), 1);
    this.emitter.emit('did-remove', task);
  }

  next() {
    if(this.paused || this.destroyed) return;
    if(this.runningCount >= this.concurrency) return;

    //Fire finish event if there are no tasks left
    if(!this.tasks.length) return this.emitter.emit('did-finish');

    //Get a task from queue then run it
    //this.runTask never rejects
    this.runTask(this.tasks.shift()).then(()=> this.next());

    //Call next to run multiple tasks concurrently
    this.next();
  }

  _runWithTimeout(task) {
    return new Promise((resolve, reject)=> {
      const timer = setTimeout(()=> {
        const err = new Error('Timeout');
        err.code = 'ETIMEDOUT';
        reject(err);
      }, this.timeout);

      Promise.resolve()
        .then(task)
        .then(resolve)
        .catch(reject)
        .finally(()=> clearTimeout(timer));
    });
  }

  async runTask(task) {
    try {
      this.runningCount++;
      this.emitter.emit('will-run', task);
      const result = await (this.timeout? this._runWithTimeout(task): task());
      this.emitter.emit('did-run', { task , result });
    } catch (error) {
      this.emitter.emit('did-fail', { task, error });
    } finally {
      this.runningCount--;
    }
  }

  pause() {
    this.paused = true;
    this.emitter.emit('did-pause');
  }

  resume() {
    this.paused = false;
    this.next();
    this.emitter.emit('did-resume');
  }

  start() {
    this.resume();
  }

  isPaused() {
    return this.paused;
  }

  clear() {
    this.tasks = [];
    this.emitter.emit('did-clear');
  }

  get size() {
    return this.tasks.length + this.runningCount;
  }

  onDidAdd(callback) {
    return this.emitter.on('did-add', callback);
  }

  onDidRemove(callback) {
    return this.emitter.on('did-remove', callback);
  }

  onWillRun(callback) {
    return this.emitter.on('will-run', callback);
  }

  onDidRun(callback) {
    return this.emitter.on('did-run', callback);
  }

  onDidFail(callback) {
    return this.emitter.on('did-fail', callback);
  }

  onDidPause(callback) {
    return this.emitter.on('did-pause', callback);
  }

  onDidResume(callback) {
    return this.emitter.on('did-resume', callback);
  }

  onDidClear(callback) {
    return this.emitter.on('did-clear', callback);
  }

  onDidFinish(callback) {
    return this.emitter.on('did-finish', callback);
  }

  onWillDestroy(callback) {
    return this.emitter.on('will-destroy', callback);
  }

  destroy() {
    this.emitter.emit('will-destroy');
    this.destroyed = true;
    this.tasks = [];
    this.emitter.dispose();
  }
}

module.exports = Queue;
