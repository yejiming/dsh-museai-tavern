/**
 * 工具调用参数清洗：保证发给模型的 toolCalls.arguments 一定是合法 JSON。
 * 解析成功原样返回；失败时做轻量修复（去围栏、去尾随逗号、补全未闭合的容器），
 * 仍失败则回退为 `{}`，避免把截断/损坏的参数原样回放进下一次请求。
 */
export declare function sanitizeToolArguments(argumentsStr: string): string;
