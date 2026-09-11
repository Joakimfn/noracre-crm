import { SOCIAL_CHANNELS } from "@/lib/social-channels";

export function SocialChannelIcon({ channel }: { channel: typeof SOCIAL_CHANNELS[number] }) {
  return <span className={`social-app-icon social-app-${channel.toLowerCase()}`} aria-hidden="true">
    <img src={`/social/${channel.toLowerCase()}.svg`} alt="" width={38} height={38} />
  </span>;
}
