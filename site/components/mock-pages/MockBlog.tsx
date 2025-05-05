import { VNode } from "preact";

export function MockBlog(): VNode {
	return (
		<div class="mx-auto max-w-2xl bg-white dark:bg-gray-900 px-5 py-12 text-gray-800 dark:text-gray-200 h-full overflow-auto font-sans text-base leading-relaxed">
			{/* Header */}
			<header class="mb-14 flex flex-row justify-between items-center">
				<a href="#" class="inline-block text-2xl font-black">
					<span
						style="--myColor1: #d83a9d; --myColor2: #8a4baf; background-image: linear-gradient(45deg, var(--myColor1), var(--myColor2)); background-clip: text; -webkit-background-clip: text; color: transparent;"
					>
						overreacted
					</span>
				</a>
				<span class="relative top-[4px] italic text-sm text-gray-600 dark:text-gray-400">
					by
					{/* Avatar Placeholder */}
					<span class="relative -top-1 mx-1 inline-block h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 align-middle"></span>
				</span>
			</header>

			{/* Main Article Content */}
			<main>
				<article>
					<h1 class="text-4xl font-black leading-tight text-gray-900 dark:text-gray-100 mb-1">
						Impossible Components
					</h1>
					<p class="mt-2 text-sm text-gray-600 dark:text-gray-400 mb-8">
						April 22, 2025
					</p>

					{/* Content Body */}
					<div class="prose dark:prose-invert max-w-none space-y-6">
						{/* Pay Button Placeholder */}
						<div class="mb-8">
							<button class="mt-4 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-shadow duration-200">
								Pay what you like
							</button>
						</div>

						<p>
							Suppose I want to greet you in <i>my</i> favorite color.
						</p>
						<p>
							This would require combining information from two different
							computers. Your name would be coming from <i>your</i> computer. The
							color would be on <i>my</i> computer.
						</p>
						<p>You could imagine a component that does this:</p>

						{/* Code Block - Simplified Plain Text */}
						<div class="bg-[#282c34] rounded-lg overflow-auto text-sm font-mono p-4 text-[#abb2bf]">
							<pre>
								<code>{
`import { useState } from 'react';
import { readFile } from 'fs/promises';

async function ImpossibleGreeting() {
  const [yourName, setYourName] = useState('Alice');
  const myColor = await readFile('./color.txt', 'utf8');
  return (
    <>
      <input placeholder="What's your name?"
        value={yourName}
        onChange={e => setYourName(e.target.value)}
      />
      <p style={{ color: myColor }}>
        Hello, {yourName}!
      </p>
    </>
  );
}`
								}</code>
							</pre>
						</div>

						<p>
							But this component is impossible. The{` `}
							<code class="rounded-lg bg-yellow-200 dark:bg-yellow-800 px-1 text-yellow-900 dark:text-yellow-100">
								readFile
							</code>
							{` `}function can only execute on <i>my</i> computer. The{` `}
							<code class="rounded-lg bg-yellow-200 dark:bg-yellow-800 px-1 text-yellow-900 dark:text-yellow-100">
								useState
							</code>
							{` `}will only have a useful value on <i>your</i> computer. We can't
							do both at once without giving up the predictable top-down
							execution flow.
						</p>
						<p>Or can we?</p>
					</div>
				</article>
			</main>
		</div>
	);
} 