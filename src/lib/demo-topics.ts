export const DEMO_TOPICS = [
  { id: 'java-kubernetes', label: 'Java on Kubernetes', topic: 'How can a simple Java application run on Kubernetes?', goal: 'Explain containers, Deployments, and Services, and identify which reliability responsibilities remain with the developer.', draft: 'A Java application can be packaged as a container image. My starting hypothesis is that a Kubernetes Deployment manages running copies of that application, while a Service provides a stable way to reach them. I still need to check what happens when a Pod fails and what Kubernetes cannot guarantee.', sources: ['deployments', 'services'] },
  { id: 'service-discovery', label: 'How services find each other', topic: 'How do Kubernetes Services help applications communicate when Pods change?', goal: 'Compare the lifetime of Pods with stable Service addressing and distinguish ClusterIP from other exposure options.', draft: 'Applications need a dependable address for communicating with each other. Pods can be replaced, so their individual addresses may change. I think a Service separates the address a client uses from the Pods that handle requests. I need evidence about how selectors and endpoints make this work.', sources: ['services'] },
  { id: 'rolling-updates', label: 'Updating an app safely', topic: 'How do Kubernetes Deployments perform rolling updates, and what can still go wrong?', goal: 'Explain desired state, rolling updates, and rollout limitations without claiming that every update is automatically safe.', draft: 'Replacing every running copy of an application at once could interrupt its users. My initial explanation is that a rolling update replaces copies gradually. I need to understand which settings control this process and why application readiness still matters.', sources: ['deployments'] },
] as const
export const DEMO_SOURCE_CATALOG = {
  deployments: { title: 'Kubernetes documentation: Deployments', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/', textUrl: 'https://raw.githubusercontent.com/kubernetes/website/main/content/en/docs/concepts/workloads/controllers/deployment.md' },
  services: { title: 'Kubernetes documentation: Service', url: 'https://kubernetes.io/docs/concepts/services-networking/service/', textUrl: 'https://raw.githubusercontent.com/kubernetes/website/main/content/en/docs/concepts/services-networking/service.md' },
} as const
export function demoStarterContent(topic: typeof DEMO_TOPICS[number]) {
  return JSON.stringify({ type: 'doc', content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: topic.topic }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'DEMO STARTER — this editable explanation is a starting hypothesis, not a reviewed finding. Read the sources and revise it as you demonstrate.' }] },
    { type: 'paragraph', content: [{ type: 'text', text: topic.draft }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Evidence and limitations to investigate' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Which passage supports my explanation? What assumptions have I made? What remains uncertain?' }] },
  ] })
}

/** Remove documentation build directives while retaining prose, Markdown and code. */
export function readableDocumentation(text: string) {
  return text.replace(/^---[\s\S]*?\n---\s*/, '')
    .replace(/<!--[^]*?-->/g, '')
    .replace(/\{\{<[^>]*text="([^"]+)"[^>]*>\}\}/g, '$1')
    .replace(/\{\{[<%][^]*?[>%]\}\}/g, '')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n').trim()
}
