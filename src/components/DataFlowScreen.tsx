import { useOverlay } from '../lib/overlay';
import { useNet } from '../lib/net';
import { useSettings } from '../store/settings';
import { Icon } from './Icon';

const when = (t: number) =>
  new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Конфиденциальность: что где хранится и куда уходят данные. Журнал ведёт само приложение. */
export function DataFlowScreen({ onClose: onCloseProp }: { onClose: () => void }) {
  const { closing, close } = useOverlay(onCloseProp);
  const hosts = useNet((s) => s.hosts);
  const reset = useNet((s) => s.reset);
  const secure = useSettings((s) => s.secure);
  const rows = Object.entries(hosts).sort((a, b) => b[1].last - a[1].last);

  return (
    <div className={`${closing ? 'anim-page-out' : 'anim-page'} fixed inset-0 z-[55] overflow-y-auto bg-zinc-950`}>
      <div className="mx-auto w-full max-w-md px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mb-4 flex items-center gap-2">
          <button onClick={close} className="rounded-xl p-2 text-zinc-300" aria-label="Назад">
            <Icon name="left" />
          </button>
          <h1 className="font-display text-xl font-semibold">Данные и приватность</h1>
        </div>

        <div className="space-y-5 text-sm text-zinc-300">
          <section className="space-y-2 rounded-2xl bg-zinc-900 p-4">
            <div className="font-medium text-zinc-50">Что знает разработчик Equality</div>
            <p>
              Ничего. У приложения нет своего сервера, аккаунтов, аналитики и отчётов об ошибках. Ключи и чаты хранятся только на этом
              устройстве, а запросы идут напрямую от телефона к выбранному тобой провайдеру. Нам некуда их отправлять.
            </p>
          </section>

          <section className="space-y-2 rounded-2xl bg-zinc-900 p-4">
            <div className="font-medium text-zinc-50">Как это защищено</div>
            <ul className="list-disc space-y-1.5 pl-5 text-zinc-400">
              <li>
                Ключи API:{' '}
                {secure?.ok
                  ? 'в защищённом хранилище Android (Keystore), в зашифрованном виде.'
                  : secure
                    ? `хранилище Android не запустилось (${secure.error ?? 'ошибка'}), поэтому пока в личной памяти приложения.`
                    : 'в личной памяти приложения.'}
              </li>
              <li>Облачные копии и резервные копии Android для приложения выключены: данные не уходят с телефона незаметно.</li>
              <li>Приложение умеет обращаться только к адресам провайдеров и к твоему серверу. Остальные запросы блокируются.</li>
              <li>Картинки из ответов модели не загружаются: по ним можно было бы отследить пользователя.</li>
            </ul>
          </section>

          <section className="space-y-2 rounded-2xl bg-zinc-900 p-4">
            <div className="font-medium text-zinc-50">Что видит провайдер</div>
            <p className="text-zinc-400">
              Провайдер (Google, OpenRouter, Groq и другие) получает твои сообщения и ключ: иначе он не мог бы отвечать. Как он их хранит и
              использует, зависит от его правил, их стоит прочитать. Для чувствительных разговоров выбирай провайдера, которому доверяешь.
            </p>
            <p className="text-zinc-400">
              Если в чате включён поиск в интернете, запрос, который сформулировала модель (а не вся переписка), получает сервис поиска (Tavily или Serper): тот, который ты выбрал и ключ которого ввёл сам. По умолчанию поиск выключен.
            </p>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <div className="font-medium text-zinc-50">Куда обращалось приложение</div>
              {rows.length > 0 && (
                <button onClick={reset} className="text-xs text-zinc-500 underline underline-offset-2">
                  Очистить
                </button>
              )}
            </div>
            {rows.length === 0 && <div className="rounded-2xl border border-dashed border-zinc-700 p-4 text-center text-zinc-500">Пока ни одного запроса</div>}
            <div className="space-y-2">
              {rows.map(([host, st]) => (
                <div key={host} className="flex items-center gap-3 rounded-2xl bg-zinc-900 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-zinc-100">{host}</div>
                    <div className="text-xs text-zinc-500">последний: {when(st.last)}</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-zinc-300">{st.count} запр.</div>
                    {st.blocked > 0 && <div className="text-red-300">заблокировано {st.blocked}</div>}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-500">Если здесь появится адрес, который ты не узнаёшь, это повод насторожиться.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
