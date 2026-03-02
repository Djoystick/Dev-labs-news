import { Container } from '@/components/layout/container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AdminEditPage() {
  return (
    <Container className="safe-pb py-10">
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle>Admin edit route scaffolded</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground">
            Stage 4 will bind this page to post loading and update actions after the Supabase data layer is in place.
          </p>
        </CardContent>
      </Card>
    </Container>
  );
}
