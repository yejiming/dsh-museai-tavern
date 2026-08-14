import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client';
/** The MuseAI tab's full component props: the framework view seat + the locale seat. */
export type MuseAIViewProps = ConvViewProps & PropsLocale<'museai'>;
/**
 * The MuseAI session view: header tabs + scrollable page area.
 * @param props - framework view props (sessionId etc., unused for now) and
 * the locale seat.
 */
export declare function MuseAIView(props: MuseAIViewProps): JSX.Element;
