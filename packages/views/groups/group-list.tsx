"use client";

import { useQuery } from "@tanstack/react-query";
import { groupKeys } from "@multica/core/groups/queries";
import { useCreateGroup } from "@multica/core/groups/mutations";
import { api } from "@multica/core/api";
import { useNavigation } from "@multica/views/navigation";
import { Button } from "@multica/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@multica/ui/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@multica/ui/components/ui/dialog";
import { Input } from "@multica/ui/components/ui/input";
import { Textarea } from "@multica/ui/components/ui/textarea";
import { useState } from "react";
import { useTranslation } from "@multica/core";
import { MessageCircle, Plus, Users } from "lucide-react";

export function GroupList({ wsId }: { wsId: string }) {
  const { t } = useTranslation();
  const { data: groups, isLoading } = useQuery({
    queryKey: groupKeys.lists(wsId),
    queryFn: () => api.listGroups(),
    staleTime: Infinity,
    enabled: !!wsId,
  });
  const { push } = useNavigation();
  const createGroup = useCreateGroup();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createGroup.mutateAsync({ name: name.trim(), announcement: announcement.trim() });
    setOpen(false);
    setName("");
    setAnnouncement("");
  };

  if (isLoading) return <div className="p-6">{t("common.loading")}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("groups.title")}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4 mr-2" />
            {t("groups.createGroup")}
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("groups.createGroup")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input
                placeholder={t("groups.groupName")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Textarea
                placeholder={t("groups.announcementPlaceholder")}
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                rows={3}
              />
              <Button onClick={handleCreate} disabled={!name.trim()} className="w-full">
                {t("common.create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {groups?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <MessageCircle className="size-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">{t("groups.noGroups")}</p>
            <p className="text-sm">{t("groups.noGroupsDescription")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups?.map((group) => (
            <Card
              key={group.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => push(`/groups/${group.id}`)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageCircle className="size-5 text-primary" />
                  {group.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="size-4" />
                    {group.member_count}
                  </span>
                </div>
                {group.announcement && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {group.announcement}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
