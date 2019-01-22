const Queue = require('../src/queue');

test('Test onWillDestroy()', (done)=> {
  const queue = new Queue();
  queue.onWillDestroy(done);
  queue.destroy();
  queue.add(jest.fn()); //Should do nothing
});

test('Test add() and onDidAdd()', (done)=> {
  const queue = new Queue();
  const task = ()=> {};
  queue.onDidAdd((_task)=> {
    expect(_task).toBe(task);
    done();
  });
  queue.add(task, task, task, task, task);
  expect(queue.size).toBe(5);
});

test('Test timeout', (done)=> {
  const queue = new Queue({ timeout: 500 });
  const task = ()=> new Promise((resolve)=>{ setTimeout(resolve, 600)});
  queue.add(task);
  queue.onDidFail(({ error })=> {
    expect(error.code).toBe('ETIMEDOUT');
    queue.destroy();
    done();
  });
});

test('Test _runWithTimeout() error', (done)=> {
  const queue = new Queue({ timeout: 500 });
  const task = jest.fn().mockRejectedValue(new Error('Hello World'));
  queue.add(task);
  queue.onDidFail(({ error })=> {
    expect(error.message).toBe('Hello World');
    queue.destroy();
    done();
  });
});

test('Test clear()', (done)=> {
  const queue = new Queue();
  const task = jest.fn();
  queue.onDidClear(()=> {
    expect(task).toHaveBeenCalledTimes(1);
    queue.destroy();
    done();
  });
  queue.onDidRun(()=> queue.clear()); //Clear after first run
  queue.add(task, task, task, task, task);
});

test('Test onDidAdd() error', ()=> {
  const queue = new Queue();
  try {
    queue.add('abcd');
    expect(true).toBe(false);
  } catch (err) {
    expect(err.message).toBe('Task must be a function');
  }
  queue.destroy();
});

test('Test remove() and onDidRemove()', (done)=> {
  const queue = new Queue({ automatic: false });
  queue.onDidRemove(()=> done());
  const task = ()=> {};
  queue.add(task);
  queue.remove(task);
  queue.remove(task);
  queue.destroy();
});

test('Test pause() and onDidPause()', (done)=> {
  const queue = new Queue();
  queue.onDidPause(()=> done());
  queue.pause();
  queue.pause(); //Should to nothing
  expect(queue.isPaused()).toBe(true);
  queue.destroy();
});

test('Test resume() and onDidResume()', (done)=> {
  const queue = new Queue();
  queue.onDidResume(()=> done());
  queue.pause();
  queue.resume(); //Should to nothing
  queue.start(); //Start is just an alias for resume()
  queue.destroy();
});

test('Test onWillRun()', (done)=> {
  const queue = new Queue();
  const task = jest.fn();
  queue.onWillRun((_task)=> {
    expect(_task).toBe(task);
    queue.destroy();
    done();
  });
  queue.add(task);
});

test('Test onDidRun()', (done)=> {
  const queue = new Queue({ timeout: 500 });
  const task = jest.fn().mockResolvedValue('hello world');
  queue.onDidRun((result)=> {
    expect(result.task).toBe(task);
    expect(result.result).toBe('hello world');
    queue.destroy();
    done();
  });
  queue.add(task);
});

test('Test onDidFail()', (done)=> {
  const queue = new Queue();
  const task = jest.fn().mockRejectedValue(new Error('hello world'));
  queue.onDidFail((result)=> {
    expect(result.task).toBe(task);
    expect(result.error.message).toContain('hello world');
    queue.destroy();
    done();
  });
  queue.add(task);
});

test('Test onDidFinish()', (done)=> {
  const queue = new Queue();
  const task = jest.fn();
  queue.onDidFinish(()=> {
    expect(task).toHaveBeenCalledTimes(5);
    queue.destroy();
    done();
  });
  queue.add(task, task, task, task, task);
});
