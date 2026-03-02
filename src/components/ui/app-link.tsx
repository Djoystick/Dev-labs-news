import * as React from 'react';
import { useHref, useLinkClickHandler, type LinkProps } from 'react-router-dom';

type AppLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & Pick<LinkProps, 'reloadDocument' | 'replace' | 'state' | 'to'>;

export const AppLink = React.forwardRef<HTMLAnchorElement, AppLinkProps>(
  ({ onClick, reloadDocument, replace, state, target, to, ...props }, ref) => {
    const href = useHref(to);
    const handleClick = useLinkClickHandler(to, {
      replace,
      state,
      target,
    });

    return (
      <a
        {...props}
        href={href}
        onClick={(event) => {
          onClick?.(event);

          if (!event.defaultPrevented && !reloadDocument) {
            handleClick(event);
          }
        }}
        ref={ref}
        target={target}
      />
    );
  },
);

AppLink.displayName = 'AppLink';
