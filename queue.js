const { Emitter } = require('event-kit');

class Queue {
  constructor({ automatic = true, concurrency = 1, timeout } = {}) {
    this.emitter = new Emitter();
    this.paused = false;
    this.destroyed = false;
    this.automatic = automatic;
    this.concurrency = concurrency;
    this.timeout = timeout;
    this.tasks = [];
    this.runningTasks = [];
  }

  _add(task) {
    if(typeof task !== 'function') throw new Error(`Task must be a function`);
    this.tasks.push(task);
    this.emitter.emit('did-add', task);
  }

  add(...tasks) {
    tasks.forEach( task=> this._add(task));
    if(!this.automatic) return;

    // run on the next tick to allow consumers to set observers after adding tasks
    process.nextTick(this.next.bind(this));
  }

  remove(task) {
    if(!this.tasks.includes(task)) return;
    this.tasks.splice(this.tasks.indexOf(task), 1);
    this.emitter.emit('did-remove', task);
  }

  next() {
    if(this.paused || this.destroyed) return;
    if(this.runningTasks.length >= this.concurrency) return;

    // fire finish event if there are no tasks left
    if(!this.tasks.length) return this.emitter.emit('did-finish');

    // get the next task then add that to running tasks list
    const nextTask = this.tasks.shift();
    this.runningTasks.push(nextTask);

    // this.runTask never rejects
    this.runTask(nextTask);

    // call next to run multiple tasks concurrently
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
    let result, error;
    this.emitter.emit('will-run', task);

    try {
      result = await (this.timeout? this._runWithTimeout(task): task());
    } catch(err) {
      error = err;
    }

    // ignore task if the queue has been cleared
    if(!this.runningTasks.includes(task)) return;

    // remove task from running task list
    this.runningTasks.splice(this.runningTasks.indexOf(task), 1);

    // notify failure or success
    if(error) {
      this.emitter.emit('did-fail', { task, error });
    } else {
      this.emitter.emit('did-run', { task , result });
    }

    // run next task
    this.next();
  }

  pause() {
    if(this.paused) return; // do not fire event if already paused
    this.paused = true;
    this.emitter.emit('did-pause');
  }

  resume() {
    this.next();
    if(!this.paused) return; // do not fire event if not paused
    this.paused = false;
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
    this.runningTasks = [];
    this.emitter.emit('did-clear');
  }

  get size() {
    return this.tasks.length + this.runningTasks.length;
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
    this.runningTasks = [];
    this.emitter.dispose();
  }
}

module.exports = Queue;
