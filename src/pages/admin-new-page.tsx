import { Container } from '@/components/layout/container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AdminNewPage() {
  return (
    <Container className="safe-pb py-10">
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle>Admin create route scaffolded</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground">
            Stage 4 will place the validated post form here. The route exists now so the navigation and file layout stay stable from the start.
          </p>
        </CardContent>
      </Card>
    </Container>
  );
}
