import { useState } from "react";
import Avatar from "boring-avatars";

const AVATAR_COLORS = [
  "#ff0000","#0000ff"
];

interface AgentAvatarProps {
  pubkey: string;
  picture?: string;
  size: number;
}

export function AgentAvatar({ pubkey, picture, size }: AgentAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const wrapStyle = { width: size, height: size, background: "#f9f9f9", borderRadius: "50%" };

  if (picture && !imgError) {
    return (
      <img
        src={picture}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={wrapStyle}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div style={wrapStyle} className="flex items-center justify-center overflow-hidden">
      <Avatar size={size} name={pubkey} variant="marble" colors={AVATAR_COLORS} />
    </div>
  );
}
