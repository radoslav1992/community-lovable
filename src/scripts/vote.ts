// Progressive enhancement for upvote forms: submit via fetch and update in place.
// Without JS the forms still work through a normal POST + redirect.
document.addEventListener('submit', async (e) => {
  const form = e.target as HTMLFormElement;
  if (!form.matches('form[data-vote]')) return;
  e.preventDefault();
  const res = await fetch(form.action, {
    method: 'POST',
    body: new FormData(form),
    headers: { Accept: 'application/json' },
  });
  if (res.redirected || res.status === 401) {
    window.location.href = '/vhod';
    return;
  }
  if (!res.ok) return;
  const data = (await res.json()) as { votes: number; voted: boolean };
  const scope = form.closest('[data-vote-scope]') ?? form.parentElement;
  const count = scope?.querySelector('[data-vote-count]');
  if (count) count.textContent = String(data.votes);
  form.querySelector('button')?.classList.toggle('voted', data.voted);
});
