export function subjectPath(subjectId: string): string {
  return `/subject/${encodeURIComponent(subjectId)}`;
}

/** Shuffle options live in the URL (?sq=1&so=1) so a quiz link can be shared or bookmarked as-is. */
export function quizPath(subjectId: string, topicId: string, shuffleQuestions: boolean, shuffleOptions: boolean): string {
  const params = new URLSearchParams();
  if (shuffleQuestions) params.set('sq', '1');
  if (shuffleOptions) params.set('so', '1');
  const qs = params.toString();
  return `/quiz/${encodeURIComponent(subjectId)}/${encodeURIComponent(topicId)}${qs ? `?${qs}` : ''}`;
}
